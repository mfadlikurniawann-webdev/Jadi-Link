import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsMetricRow } from './analytics.types';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const userId = '11111111-1111-4111-8111-111111111111';
  const linkId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    $queryRaw: jest.fn<Promise<AnalyticsMetricRow[]>, [Prisma.Sql]>(),
  };
  const emptyMetrics: AnalyticsMetricRow[] = [
    { kind: 'total', label: null, clicks: 0n, uniqueVisitors: 0n },
    { kind: 'window', label: null, clicks: 0n, uniqueVisitors: 0n },
  ];

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-26T13:45:00Z'));
    jest.resetAllMocks();
    prisma.$queryRaw.mockResolvedValue(emptyMetrics);
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });
  afterEach(() => jest.useRealTimers());

  it('uses one parameterized query with link ID, JWT user ID and UTC bounds', async () => {
    const result = await service.forLink(userId, linkId);
    expect(result.linkId).toBe(linkId);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.values).toEqual([
      linkId,
      userId,
      '2026-10-28T00:00:00.000Z',
      '2026-11-26T13:45:00.000Z',
      '2026-11-26T13:45:00.000Z',
      10,
    ]);
    expect(query.sql).toContain('"userId" = ?::uuid');
    expect(query.sql).toContain('INNER JOIN owned_link');
    expect(query.sql).not.toContain(linkId);
    expect(query.sql).not.toContain(userId);
  });

  it('returns an empty owned link as 200-compatible zero statistics, not 404', async () => {
    await expect(service.forLink(userId, linkId)).resolves.toMatchObject({
      totalClicks: 0,
      clicksLast30Days: 0,
      uniqueVisitorsLast30Days: 0,
    });
  });

  it('returns the same 404 for an absent link or a different owner', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(service.forLink(userId, linkId)).rejects.toEqual(
      new NotFoundException('Link not found'),
    );
  });

  it('maps bigint aggregates to numeric API fields', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { kind: 'total', label: null, clicks: 9n, uniqueVisitors: 0n },
      { kind: 'window', label: null, clicks: 2n, uniqueVisitors: 1n },
      { kind: 'daily', label: '2026-11-26', clicks: 2n, uniqueVisitors: 0n },
    ]);
    const result = await service.forLink(userId, linkId);
    expect(result.totalClicks).toBe(9);
    expect(result.dailyClicks[29]).toEqual({ date: '2026-11-26', clicks: 2 });
    expect(result.uniqueVisitorsLast30Days).toBe(1);
  });

  it('does not swallow database errors or substitute false zero statistics', async () => {
    const failure = new Error('Database unavailable');
    prisma.$queryRaw.mockRejectedValue(failure);
    await expect(service.forLink(userId, linkId)).rejects.toBe(failure);
  });
});
