import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import type { AnalyticsMetricRow } from '../src/analytics/analytics.types';
import type { AnalyticsResponseDto } from '../src/analytics/dto/analytics-response.dto';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 5 analytics HTTP tests (real JWT, database mocked)', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let otherToken: string;
  let remoteAddress: string;
  let ipSequence = 0;
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const linkId = randomUUID();
  const records = new Map<
    string,
    { userId: string; rows: AnalyticsMetricRow[] }
  >();
  const emptyRows: AnalyticsMetricRow[] = [
    { kind: 'total', label: null, clicks: 0n, uniqueVisitors: 0n },
    { kind: 'window', label: null, clicks: 0n, uniqueVisitors: 0n },
  ];
  const prisma = {
    $queryRaw: jest.fn((query: Prisma.Sql) => {
      const [id, userId] = query.values;
      const record = typeof id === 'string' ? records.get(id) : undefined;
      return Promise.resolve(
        record && record.userId === userId ? record.rows : [],
      );
    }),
  };
  const get = (id: string = linkId, token = ownerToken, query = '') =>
    app.inject({
      method: 'GET',
      url: `/api/links/${id}/analytics${query}`,
      remoteAddress,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

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
    jest.clearAllMocks();
    records.clear();
    records.set(linkId, { userId: ownerId, rows: emptyRows });
    remoteAddress = `198.51.100.${++ipSequence}`;
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns zero analytics with 30 UTC days and no-store for an owned empty link', async () => {
    const response = await get();
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const result = response.json<AnalyticsResponseDto>();
    expect(result).toMatchObject({
      linkId,
      totalClicks: 0,
      clicksLast30Days: 0,
      uniqueVisitorsLast30Days: 0,
      period: { timezone: 'UTC', days: 30 },
      countries: [],
      topReferrers: [],
    });
    expect(result.dailyClicks).toHaveLength(30);
    expect(result.dailyClicks.every((day) => day.clicks === 0)).toBe(true);
    expect(result.dailyClicks[0]?.date).toBe(result.period.from.slice(0, 10));
    expect(result.dailyClicks[29]?.date).toBe(result.period.to.slice(0, 10));
    expect(Date.parse(result.period.to)).toBeLessThanOrEqual(Date.now());
    expect(result.devices).toHaveLength(5);
    expect(result.devices.every((item) => item.clicks === 0)).toBe(true);
  });

  it('returns numeric totals, zero-filled daily series and breakdowns without identifiers/hashes', async () => {
    const today = new Date().toISOString().slice(0, 10);
    records.set(linkId, {
      userId: ownerId,
      rows: [
        { kind: 'total', label: null, clicks: 8n, uniqueVisitors: 0n },
        { kind: 'window', label: null, clicks: 3n, uniqueVisitors: 2n },
        { kind: 'daily', label: today, clicks: 3n, uniqueVisitors: 0n },
        {
          kind: 'referrer',
          label: 'search.example',
          clicks: 2n,
          uniqueVisitors: 0n,
        },
        { kind: 'referrer', label: null, clicks: 1n, uniqueVisitors: 0n },
        { kind: 'country', label: 'ID', clicks: 2n, uniqueVisitors: 0n },
        { kind: 'country', label: null, clicks: 1n, uniqueVisitors: 0n },
        { kind: 'device', label: 'mobile', clicks: 2n, uniqueVisitors: 0n },
        { kind: 'device', label: 'unknown', clicks: 1n, uniqueVisitors: 0n },
      ],
    });
    const response = await get();
    expect(response.statusCode).toBe(200);
    const result = response.json<AnalyticsResponseDto>();
    expect(result.totalClicks).toBe(8);
    expect(result.clicksLast30Days).toBe(3);
    expect(result.uniqueVisitorsLast30Days).toBe(2);
    expect(result.dailyClicks[29]).toEqual({ date: today, clicks: 3 });
    expect(result.dailyClicks.reduce((sum, day) => sum + day.clicks, 0)).toBe(
      3,
    );
    expect(result.topReferrers).toEqual([
      { referrer: 'search.example', clicks: 2 },
      { referrer: null, clicks: 1 },
    ]);
    expect(result.countries).toEqual([
      { country: 'ID', clicks: 2 },
      { country: null, clicks: 1 },
    ]);
    expect(result.devices.reduce((sum, item) => sum + item.clicks, 0)).toBe(3);
    expect(response.body).not.toContain('visitorHash');
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain(ownerId);
  });

  it('requires a token before running the aggregation', async () => {
    expect((await get(linkId, '')).statusCode).toBe(401);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects another owner with 404 and does not expose their counts', async () => {
    const response = await get(linkId, otherToken);
    expect(response.statusCode).toBe(404);
    expect(response.json<{ message: string }>().message).toBe('Link not found');
    expect(response.body).not.toContain('totalClicks');
    expect(response.body).not.toContain(ownerId);
  });

  it('does not let a query-string userId override the JWT owner', async () => {
    expect(
      (await get(linkId, otherToken, `?userId=${ownerId}`)).statusCode,
    ).toBe(404);
    const query = prisma.$queryRaw.mock.calls[0]?.[0];
    expect(query?.values[1]).toBe(otherId);
  });

  it('returns 404 for a missing or deleted link', async () => {
    records.delete(linkId);
    expect((await get()).statusCode).toBe(404);
  });

  it.each(['not-a-uuid', "' OR '1'='1"])(
    'rejects invalid identifier %s without a query',
    async (id) => {
      expect((await get(encodeURIComponent(id))).statusCode).toBe(400);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    },
  );

  it('does not expose analytics outside the /api prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/links/${linkId}/analytics`,
      remoteAddress,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(response.statusCode).toBe(404);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns a consistent 500 instead of fake zeroes when the database fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('sensitive SQL details'));
    const response = await get();
    expect(response.statusCode).toBe(500);
    expect(response.json<{ message: string }>().message).toBe(
      'Internal server error',
    );
    expect(response.body).not.toContain('sensitive SQL details');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('limits expensive analytics to 30 requests per minute/IP', async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      expect((await get()).statusCode).toBe(200);
    }
    const blocked = await get();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(30);
    remoteAddress = `198.51.100.${++ipSequence}`;
    expect((await get()).statusCode).toBe(200);
  });
});
