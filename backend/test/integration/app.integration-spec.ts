import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { AnalyticsResponseDto } from '../../src/analytics/dto/analytics-response.dto';
import type { AuthResponseDto } from '../../src/auth/dto/auth-response.dto';
import { configureApp } from '../../src/common/configure-app';
import type { LinkResponseDto } from '../../src/links/dto/link-response.dto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ClickBufferService } from '../../src/redirect/click-buffer.service';
import { parseTestDatabaseUrl, TemporaryDatabase } from './database';

describe('Real PostgreSQL end-to-end flow', () => {
  let database: TemporaryDatabase | undefined;
  let app: NestFastifyApplication | undefined;
  let prisma: PrismaService;
  let buffer: ClickBufferService;
  const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: Record<string, unknown>,
  ) =>
    app!.inject({
      method,
      url,
      payload,
      remoteAddress: '127.0.0.1',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    database = new TemporaryDatabase(
      parseTestDatabaseUrl(process.env['TEST_DATABASE_URL']),
    );
    await database.createAndMigrate();
    process.env['DATABASE_URL'] = database.url;
    process.env['DIRECT_URL'] = database.url;
    // Import only AFTER assigning the isolated URL: ConfigModule validates on import.
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ trustProxy: ['127.0.0.1', '::1'] }),
    );
    app.useLogger(false);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    buffer = app.get(ClickBufferService);
    // Periodic flush has its own fake-timer unit test; control flush timing here.
    buffer.onModuleDestroy();
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      if (database) await database.dispose();
    }
  });

  it('registers → logs in → creates a link → redirects → batches clicks → reads analytics → updates → deletes', async () => {
    const email = `flow-${randomUUID()}@example.com`;
    const password = 'integration-test-password-123';
    const registration = await request(
      'POST',
      '/api/auth/register',
      undefined,
      {
        email: ` ${email.toUpperCase()} `,
        password,
      },
    );
    expect(registration.statusCode).toBe(201);
    expect(registration.json<AuthResponseDto>().user.email).toBe(email);
    expect(registration.body).not.toContain('passwordHash');
    const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(saved.passwordHash).not.toBe(password);
    expect(saved.passwordHash).toMatch(/^\$2b\$12\$/);
    const duplicateUser = await request(
      'POST',
      '/api/auth/register',
      undefined,
      {
        email,
        password,
      },
    );
    expect(duplicateUser.statusCode).toBe(409);

    const login = await request('POST', '/api/auth/login', undefined, {
      email,
      password,
    });
    expect(login.statusCode).toBe(200);
    const { accessToken } = login.json<AuthResponseDto>();
    const created = await request('POST', '/api/links', accessToken, {
      targetUrl: 'https://example.com/integration',
    });
    expect(created.statusCode).toBe(201);
    const link = created.json<LinkResponseDto>();
    expect(link.code).toHaveLength(7);
    const duplicateCode = await request('POST', '/api/links', accessToken, {
      targetUrl: 'https://example.com/another',
      alias: link.code,
    });
    expect(duplicateCode.statusCode).toBe(409);
    expect(
      (await request('GET', `/api/links/${link.id}`, accessToken)).statusCode,
    ).toBe(200);
    const redirect = await request('GET', `/${link.code}`);
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe('https://example.com/integration');
    await nextTurn();
    expect(await prisma.click.count({ where: { linkId: link.id } })).toBe(0);
    expect(buffer.pendingCount).toBe(1);
    await buffer.flush();
    expect(await prisma.click.count({ where: { linkId: link.id } })).toBe(1);
    const analytics = await request(
      'GET',
      `/api/links/${link.id}/analytics`,
      accessToken,
    );
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json<AnalyticsResponseDto>()).toMatchObject({
      totalClicks: 1,
      clicksLast30Days: 1,
      uniqueVisitorsLast30Days: 1,
    });

    const updated = await request(
      'PATCH',
      `/api/links/${link.id}`,
      accessToken,
      {
        targetUrl: 'https://example.com/updated',
      },
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json<LinkResponseDto>().code).toBe(link.code);
    expect((await request('GET', `/${link.code}`)).headers.location).toBe(
      'https://example.com/updated',
    );
    expect(
      (await request('DELETE', `/api/links/${link.id}`, accessToken))
        .statusCode,
    ).toBe(204);
    expect((await request('GET', `/${link.code}`)).statusCode).toBe(404);
    await nextTurn();
    await buffer.flush(); // A buffered click for the deleted link cannot poison a batch.
    expect(buffer.pendingCount).toBe(0);
    expect(await prisma.click.count({ where: { linkId: link.id } })).toBe(0);
    expect(
      (await request('GET', `/api/links/${link.id}/analytics`, accessToken))
        .statusCode,
    ).toBe(404);
  });

  it('uses correct UTC boundaries, distinct visitors and ownership with real SQL', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `sql-${randomUUID()}@example.com`,
        passwordHash: 'test-only-not-a-login-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `other-${randomUUID()}@example.com`,
        passwordHash: 'test-only-not-a-login-hash',
      },
    });
    const token = await app!.get(JwtService).signAsync({ sub: owner.id });
    const otherToken = await app!.get(JwtService).signAsync({ sub: other.id });
    const link = await prisma.link.create({
      data: {
        userId: owner.id,
        code: `sql-${randomUUID()}`,
        targetUrl: 'https://example.com/',
      },
    });
    const initial = await request(
      'GET',
      `/api/links/${link.id}/analytics`,
      token,
    );
    expect(initial.statusCode).toBe(200);
    const empty = initial.json<AnalyticsResponseDto>();
    const from = Date.parse(empty.period.from);
    const today = new Date(empty.period.to);
    today.setUTCHours(0, 0, 0, 0);
    await prisma.click.createMany({
      data: [
        {
          linkId: link.id,
          clickedAt: new Date(from - 1),
          visitorHash: 'c'.repeat(64),
        },
        {
          linkId: link.id,
          clickedAt: new Date(from),
          country: 'ID',
          device: 'mobile',
          visitorHash: 'a'.repeat(64),
        },
        {
          linkId: link.id,
          clickedAt: new Date(from + 1000),
          country: 'ID',
          device: 'mobile',
          visitorHash: 'a'.repeat(64),
        },
        {
          linkId: link.id,
          clickedAt: new Date(today.getTime() - 1),
          visitorHash: 'b'.repeat(64),
        },
        {
          linkId: link.id,
          clickedAt: today,
          country: 'XX',
          device: 'legacy',
          visitorHash: null,
        },
        {
          linkId: link.id,
          clickedAt: new Date(Date.now() + 86400000),
          visitorHash: 'd'.repeat(64),
        },
      ],
    });
    const response = await request(
      'GET',
      `/api/links/${link.id}/analytics`,
      token,
    );
    expect(response.statusCode).toBe(200);
    const stats = response.json<AnalyticsResponseDto>();
    expect(stats.totalClicks).toBe(5);
    expect(stats.clicksLast30Days).toBe(4);
    expect(stats.uniqueVisitorsLast30Days).toBe(2);
    expect(stats.dailyClicks[0]?.clicks).toBe(2);
    expect(stats.dailyClicks[28]?.clicks).toBe(1);
    expect(stats.dailyClicks[29]?.clicks).toBe(1);
    expect(stats.dailyClicks.reduce((sum, day) => sum + day.clicks, 0)).toBe(4);
    expect(stats.countries).toEqual([
      { country: null, clicks: 2 },
      { country: 'ID', clicks: 2 },
    ]);
    for (const url of [
      `/api/links/${link.id}`,
      `/api/links/${link.id}/analytics`,
    ]) {
      expect((await request('GET', url, otherToken)).statusCode).toBe(404);
    }
    expect(
      (
        await request('PATCH', `/api/links/${link.id}`, otherToken, {
          isActive: false,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request('DELETE', `/api/links/${link.id}`, otherToken)).statusCode,
    ).toBe(404);
  });
});

describe('Integration database safety', () => {
  it.each([
    undefined,
    'not-a-url',
    'postgresql://user:password@database.remote.example/postgres',
    'postgresql://user:password@127.0.0.1/application_database',
    'postgresql://user:password@127.0.0.1/postgres?host=database.remote.example',
    'https://user:password@127.0.0.1/postgres',
  ])(
    'rejects an unsafe or missing admin URL without echoing it: %s',
    (value) => {
      expect(() => parseTestDatabaseUrl(value)).toThrow(
        'TEST_DATABASE_URL must be',
      );
    },
  );
});
