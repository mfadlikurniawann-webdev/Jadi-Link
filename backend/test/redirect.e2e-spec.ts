import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { Link } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { RedirectCacheService } from '../src/common/cache/redirect-cache.service';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClickBufferService } from '../src/redirect/click-buffer.service';
import type { BufferedClickDto } from '../src/redirect/dto/buffered-click.dto';

describe('Phase 4 public redirect HTTP tests (database mocked)', () => {
  let app: NestFastifyApplication;
  let buffer: ClickBufferService;
  let cache: RedirectCacheService;
  let token: string;
  let remoteAddress: string;
  let ipSequence = 0;
  const ownerId = randomUUID();
  const links = new Map<string, Link>();
  const seed = (extra: Partial<Link> = {}): Link => {
    const link: Link = {
      id: randomUUID(),
      code: 'abc234X',
      userId: ownerId,
      targetUrl: 'https://example.com/original',
      expiresAt: null,
      isActive: true,
      createdAt: new Date(),
      ...extra,
    };
    links.set(link.code, link);
    return link;
  };
  const missing = () =>
    new Prisma.PrismaClientKnownRequestError('Missing record', {
      code: 'P2025',
      clientVersion: '7.10.1',
    });
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    click: {
      createMany: jest.fn(
        (options: { data: BufferedClickDto[]; skipDuplicates: boolean }) =>
          Promise.resolve({ count: options.data.length }),
      ),
    },
    link: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { code?: string; id?: string; userId?: string };
        }) => {
          const link = where.code
            ? links.get(where.code)
            : [...links.values()].find(
                (item) => item.id === where.id && item.userId === where.userId,
              );
          return Promise.resolve(link ? { ...link } : null);
        },
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Pick<Link, 'code' | 'userId' | 'targetUrl' | 'expiresAt'>;
        }) => Promise.resolve(seed(data)),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; userId: string };
          data: Pick<Partial<Link>, 'targetUrl' | 'expiresAt' | 'isActive'>;
        }) => {
          const link = [...links.values()].find(
            (item) => item.id === where.id && item.userId === where.userId,
          );
          return link
            ? Promise.resolve(seed({ ...link, ...data }))
            : Promise.reject(missing());
        },
      ),
      delete: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) => {
          const link = [...links.values()].find(
            (item) => item.id === where.id && item.userId === where.userId,
          );
          if (!link) return Promise.reject(missing());
          links.delete(link.code);
          return Promise.resolve(link);
        },
      ),
    },
  };
  const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const get = (code = 'abc234X', headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url: `/${code}`, remoteAddress, headers });
  const patch = (id: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'PATCH',
      url: `/api/links/${id}`,
      remoteAddress,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ trustProxy: ['127.0.0.1', '::1'] }),
    );
    app.useLogger(false);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    buffer = app.get(ClickBufferService);
    cache = app.get(RedirectCacheService);
    token = await app.get(JwtService).signAsync({ sub: ownerId });
  });
  beforeEach(async () => {
    await buffer.flush();
    for (const code of links.keys()) cache.invalidate(code);
    links.clear();
    jest.clearAllMocks();
    remoteAddress = `198.51.100.${++ipSequence}`;
  });
  afterAll(async () => {
    await app.close();
  });

  it('redirects publicly with 302/no-store, caches lookup, and only buffers clicks', async () => {
    seed();
    const first = await get();
    expect(first.statusCode).toBe(302);
    expect(first.headers.location).toBe('https://example.com/original');
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body).toBe('');
    expect((await get()).statusCode).toBe(302);
    await nextTurn();
    expect(prisma.link.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.click.createMany).not.toHaveBeenCalled();
    expect(buffer.pendingCount).toBe(2);
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenCalledTimes(1);
  });

  it.each(['missing-code', 'api', 'docs', 'health', 'ab', 'file.txt'])(
    'returns 404 with no click for absent/reserved/malformed code %s',
    async (code) => {
      expect((await get(code)).statusCode).toBe(404);
      await nextTurn();
      expect(buffer.pendingCount).toBe(0);
    },
  );

  it.each([
    { isActive: false },
    { expiresAt: new Date('2020-01-01T00:00:00Z') },
  ])('returns 410 and no click for unavailable link: %j', async (extra) => {
    seed(extra);
    const response = await get();
    expect(response.statusCode).toBe(410);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(buffer.pendingCount).toBe(0);
  });

  it('keeps code matching case-sensitive and does not expose /api/:code', async () => {
    seed({ code: 'My-Link' });
    expect((await get('My-Link')).statusCode).toBe(302);
    expect((await get('my-link')).statusCode).toBe(404);
    expect((await get('api/My-Link')).statusCode).toBe(404);
  });

  it('preserves /api prefix and guard on pre-existing API routes', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect((await get('health')).statusCode).toBe(404);
    expect((await get('api/links')).statusCode).toBe(401);
    expect((await get('api/auth/me')).statusCode).toBe(401);
  });

  it('invalidates the shared cache after target/status changes and deletion', async () => {
    const link = seed();
    await get();
    expect(
      (await patch(link.id, { targetUrl: 'https://example.com/updated' }))
        .statusCode,
    ).toBe(200);
    expect((await get()).headers.location).toBe('https://example.com/updated');
    await patch(link.id, { isActive: false });
    expect((await get()).statusCode).toBe(410);
    await patch(link.id, { isActive: true });
    expect((await get()).statusCode).toBe(302);
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/links/${link.id}`,
      remoteAddress,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleted.statusCode).toBe(204);
    expect((await get()).statusCode).toBe(404);
  });

  it('does not negatively cache a code created after its first 404', async () => {
    expect((await get('brand-new')).statusCode).toBe(404);
    const created = await app.inject({
      method: 'POST',
      url: '/api/links',
      remoteAddress,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetUrl: 'https://example.com/new', alias: 'brand-new' },
    });
    expect(created.statusCode).toBe(201);
    expect((await get('brand-new')).statusCode).toBe(302);
  });

  it('records sanitized CF metadata only after a successful response', async () => {
    const link = seed();
    remoteAddress = '127.0.0.1';
    const response = await get(link.code, {
      'cf-connecting-ip': '203.0.113.15',
      'cf-ipcountry': 'ID',
      'user-agent': 'Mozilla iPhone Mobile',
      referer: 'https://Search.Example/private?token=never-store',
    });
    expect(response.statusCode).toBe(302);
    await nextTurn();
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          linkId: link.id,
          referrer: 'search.example',
          country: 'ID',
          device: 'mobile',
          visitorHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
        }),
      ],
    });
    const stored = JSON.stringify(prisma.click.createMany.mock.calls);
    expect(stored).not.toContain('203.0.113.15');
    expect(stored).not.toContain('never-store');
    expect(stored).not.toContain('Mozilla');
  });

  it('continues redirecting while a database click batch is still blocked', async () => {
    seed();
    await get();
    await nextTurn();
    let release!: (value: { count: number }) => void;
    prisma.click.createMany.mockReturnValueOnce(
      new Promise<{ count: number }>((resolve) => {
        release = resolve;
      }),
    );
    const flushing = buffer.flush();
    let responseFinished = false;
    const redirect = get().then((response) => {
      responseFinished = true;
      return response;
    });
    try {
      await nextTurn();
      expect(responseFinished).toBe(true);
    } finally {
      release({ count: 1 });
      await flushing;
    }
    expect((await redirect).statusCode).toBe(302);
  });

  it('does not count HEAD requests as clicks', async () => {
    seed();
    const response = await app.inject({
      method: 'HEAD',
      url: '/abc234X',
      remoteAddress,
    });
    expect(response.statusCode).toBe(302);
    await nextTurn();
    expect(buffer.pendingCount).toBe(0);
  });

  it('allows 600 redirect requests per minute, then returns 429', async () => {
    seed();
    const responses = await Promise.all(
      Array.from({ length: 601 }, () => get()),
    );
    expect(
      responses.filter((response) => response.statusCode === 302),
    ).toHaveLength(600);
    expect(
      responses.filter((response) => response.statusCode === 429),
    ).toHaveLength(1);
  });

  it('uses distinct CF visitor IP quotas behind one trusted proxy', async () => {
    remoteAddress = '127.0.0.1';
    const login = (ip: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress,
        headers: { 'cf-connecting-ip': ip },
        payload: {},
      });
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await login('203.0.113.51')).statusCode).toBe(400);
    }
    expect((await login('203.0.113.51')).statusCode).toBe(429);
    expect((await login('203.0.113.52')).statusCode).toBe(400);
  });

  it('does not let an untrusted peer evade login throttling by forging CF IPs', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress,
        headers: { 'cf-connecting-ip': `192.0.2.${attempt + 1}` },
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress,
      headers: { 'cf-connecting-ip': '192.0.2.200' },
      payload: {},
    });
    expect(blocked.statusCode).toBe(429);
  });
});
