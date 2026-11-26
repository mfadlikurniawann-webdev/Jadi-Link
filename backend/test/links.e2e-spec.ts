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
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface LinkPayload {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface ListPayload {
  items: LinkPayload[];
  page: number;
  limit: number;
  hasNextPage: boolean;
}

describe('Phase 3 links HTTP tests (real JWT, database mocked)', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let otherToken: string;
  let ipSequence = 0;
  let remoteAddress: string;
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const links = new Map<string, Link>();
  const databaseError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Database error', {
      code,
      clientVersion: '7.10.1',
    });
  const owned = (id: string, userId: string) => {
    const link = links.get(id);
    return link?.userId === userId ? link : null;
  };
  const prisma = {
    link: {
      create: jest.fn(
        ({
          data,
        }: {
          data: {
            code: string;
            targetUrl: string;
            userId: string;
            expiresAt: Date | null;
          };
        }) => {
          if ([...links.values()].some((link) => link.code === data.code)) {
            return Promise.reject(databaseError('P2002'));
          }
          const link: Link = {
            ...data,
            id: randomUUID(),
            isActive: true,
            createdAt: new Date(),
          };
          links.set(link.id, link);
          return Promise.resolve(link);
        },
      ),
      findMany: jest.fn(
        ({
          where,
          skip,
          take,
        }: {
          where: { userId: string };
          skip: number;
          take: number;
        }) =>
          Promise.resolve(
            [...links.values()]
              .filter((link) => link.userId === where.userId)
              .sort(
                (a, b) =>
                  b.createdAt.getTime() - a.createdAt.getTime() ||
                  b.id.localeCompare(a.id),
              )
              .slice(skip, skip + take),
          ),
      ),
      findUnique: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) =>
          Promise.resolve(owned(where.id, where.userId)),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; userId: string };
          data: Pick<Partial<Link>, 'targetUrl' | 'expiresAt' | 'isActive'>;
        }) => {
          const link = owned(where.id, where.userId);
          if (!link) {
            return Promise.reject(databaseError('P2025'));
          }
          const updated = { ...link, ...data };
          links.set(link.id, updated);
          return Promise.resolve(updated);
        },
      ),
      delete: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) => {
          const link = owned(where.id, where.userId);
          if (!link) {
            return Promise.reject(databaseError('P2025'));
          }
          links.delete(link.id);
          return Promise.resolve(link);
        },
      ),
    },
  };
  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path = '',
    payload?: Record<string, unknown>,
    token = ownerToken,
  ) =>
    app.inject({
      method,
      url: `/api/links${path}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      remoteAddress,
    });
  const createLink = async (extra: Record<string, unknown> = {}) => {
    const response = await request('POST', '', {
      targetUrl: 'https://example.com',
      ...extra,
    });
    expect(response.statusCode).toBe(201);
    return response.json<LinkPayload>();
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useLogger(false);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const jwt = app.get(JwtService);
    ownerToken = await jwt.signAsync({ sub: ownerId });
    otherToken = await jwt.signAsync({ sub: otherId });
  });

  beforeEach(() => {
    links.clear();
    remoteAddress = `203.0.113.${++ipSequence}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an automatic 7-character code with safe public fields', async () => {
    const response = await request('POST', '', {
      targetUrl: 'HTTPS://EXAMPLE.COM',
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<LinkPayload>();
    expect(body.code).toHaveLength(7);
    expect(body.shortUrl).toBe(`http://localhost:3001/${body.code}`);
    expect(body.targetUrl).toBe('https://example.com/');
    expect(body.isActive).toBe(true);
    expect(body.expiresAt).toBeNull();
    expect(body).not.toHaveProperty('userId');
    expect(links.get(body.id)?.userId).toBe(ownerId);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('creates a case-sensitive custom alias with an optional expiration', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const link = await createLink({ alias: 'My-Portfolio', expiresAt });
    expect(link.code).toBe('My-Portfolio');
    expect(link.expiresAt).toBe(expiresAt);
    expect(link.shortUrl).toBe('http://localhost:3001/My-Portfolio');
    expect((await createLink({ alias: 'my-portfolio' })).code).toBe(
      'my-portfolio',
    );
  });

  it('lets only one concurrent request claim an alias across owners', async () => {
    const results = await Promise.all([
      request('POST', '', {
        targetUrl: 'https://example.com',
        alias: 'shared-alias',
      }),
      request(
        'POST',
        '',
        { targetUrl: 'https://other.example.com', alias: 'shared-alias' },
        otherToken,
      ),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(links.size).toBe(1);
  });

  it('lists only owned links with bounded pagination', async () => {
    const first = await createLink();
    const second = await createLink();
    await request(
      'POST',
      '',
      { targetUrl: 'https://other.example.com' },
      otherToken,
    );
    const pageOne = (await request('GET', '?limit=1')).json<ListPayload>();
    expect(pageOne).toMatchObject({ page: 1, limit: 1, hasNextPage: true });
    const pageTwo = (
      await request('GET', '?limit=1&page=2')
    ).json<ListPayload>();
    expect(pageTwo).toMatchObject({ page: 2, limit: 1, hasNextPage: false });
    const ids = [...pageOne.items, ...pageTwo.items].map((link) => link.id);
    expect(new Set(ids)).toEqual(new Set([first.id, second.id]));
    expect((await request('GET')).json<ListPayload>().limit).toBe(20);
  });

  it('reads, updates, toggles, clears expiration, and deletes without changing the code', async () => {
    const link = await createLink({
      alias: 'stable-link',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect((await request('GET', `/${link.id}`)).statusCode).toBe(200);
    const update = await request('PATCH', `/${link.id}`, {
      targetUrl: 'https://updated.example.com/path',
      isActive: false,
      expiresAt: null,
    });
    expect(update.statusCode).toBe(200);
    expect(update.json<LinkPayload>()).toMatchObject({
      code: 'stable-link',
      shortUrl: link.shortUrl,
      isActive: false,
      expiresAt: null,
      targetUrl: 'https://updated.example.com/path',
    });
    expect(
      (
        await request('PATCH', `/${link.id}`, { isActive: true })
      ).json<LinkPayload>().isActive,
    ).toBe(true);
    const deletion = await request('DELETE', `/${link.id}`);
    expect(deletion.statusCode).toBe(204);
    expect(deletion.body).toBe('');
    expect((await request('GET', `/${link.id}`)).statusCode).toBe(404);
  });

  it('does not allow another user to read, update, or delete the link', async () => {
    const link = await createLink();
    const path = `/${link.id}`;
    expect((await request('GET', path, undefined, otherToken)).statusCode).toBe(
      404,
    );
    expect(
      (await request('PATCH', path, { isActive: false }, otherToken))
        .statusCode,
    ).toBe(404);
    expect(
      (await request('DELETE', path, undefined, otherToken)).statusCode,
    ).toBe(404);
    expect(links.get(link.id)?.isActive).toBe(true);
    expect(
      (await request('GET', '', undefined, otherToken)).json<ListPayload>()
        .items,
    ).toEqual([]);
  });

  it.each(['GET', 'PATCH', 'DELETE'] as const)(
    'returns 404 on %s for a nonexistent UUID',
    async (method) => {
      const response = await request(
        method,
        `/${randomUUID()}`,
        method === 'PATCH' ? { isActive: false } : undefined,
      );
      expect(response.statusCode).toBe(404);
    },
  );

  it.each([
    { targetUrl: 'javascript:alert(1)' },
    { targetUrl: 'data:text/plain,hello' },
    { targetUrl: '//example.com' },
    { targetUrl: 'http://LOCALHOST.:3000/another-link' },
    { targetUrl: 'https://user:password@example.com' },
    { targetUrl: 'https://example.com/a\nb' },
    { targetUrl: null },
    { targetUrl: 123 },
    { targetUrl: '' },
    { targetUrl: 'https://example.com', alias: 'docs' },
    { targetUrl: 'https://example.com', alias: 'API' },
    { targetUrl: 'https://example.com', alias: 'ab' },
    { targetUrl: 'https://example.com', alias: '_abc' },
    { targetUrl: 'https://example.com', alias: 'a/b' },
    { targetUrl: 'https://example.com', alias: null },
    { targetUrl: 'https://example.com', alias: 'a'.repeat(65) },
    { targetUrl: 'https://example.com', expiresAt: '2020-01-01T00:00:00Z' },
    { targetUrl: 'https://example.com', expiresAt: '2099-02-30T00:00:00Z' },
    { targetUrl: 'https://example.com', expiresAt: '2099-12-01' },
    { targetUrl: 'https://example.com', expiresAt: '2099-12-01T00:00:00' },
    { targetUrl: 'https://example.com', userId: otherId },
    { targetUrl: 'https://example.com', code: 'my-code' },
    { targetUrl: 'https://example.com', isActive: false },
    {},
  ])('rejects invalid or unexpected create fields: %j', async (payload) => {
    const response = await request('POST', '', payload);
    expect(response.statusCode).toBe(400);
    expect(links.size).toBe(0);
  });

  it.each([
    {},
    { alias: 'renamed' },
    { code: 'renamed' },
    { userId: otherId },
    { targetUrl: null },
    { targetUrl: 'http://localhost:4000/path' },
    { targetUrl: 'javascript:alert(1)' },
    { isActive: null },
    { isActive: 'false' },
    { expiresAt: '2020-01-01T00:00:00Z' },
  ])('rejects invalid updates and immutable fields: %j', async (payload) => {
    const link = await createLink();
    const response = await request('PATCH', `/${link.id}`, payload);
    expect(response.statusCode).toBe(400);
    expect(links.get(link.id)?.code).toBe(link.code);
    expect(links.get(link.id)?.isActive).toBe(true);
  });

  it.each([
    '?page=0',
    '?page=10001',
    '?limit=101',
    '?limit=0',
    '?limit=1.5',
    '?limit=nope',
    '?userId=another-user',
  ])('rejects invalid pagination or extra query fields: %s', async (query) => {
    expect((await request('GET', query)).statusCode).toBe(400);
  });

  it.each(['GET', 'PATCH', 'DELETE'] as const)(
    'validates UUID parameters on %s',
    async (method) => {
      const response = await request(
        method,
        '/not-a-uuid',
        method === 'PATCH' ? { isActive: false } : undefined,
      );
      expect(response.statusCode).toBe(400);
    },
  );

  it('protects every CRUD endpoint without a token', async () => {
    const link = await createLink();
    const calls = [
      request('GET', '', undefined, ''),
      request('POST', '', { targetUrl: 'https://example.com' }, ''),
      request('GET', `/${link.id}`, undefined, ''),
      request('PATCH', `/${link.id}`, { isActive: false }, ''),
      request('DELETE', `/${link.id}`, undefined, ''),
    ];
    for (const response of await Promise.all(calls)) {
      expect(response.statusCode).toBe(401);
    }
    expect(links.size).toBe(1);
  });
});
