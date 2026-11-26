import { DEVICE_TYPES, MILLISECONDS_PER_DAY } from './analytics.constants';
import type { AnalyticsMetricRow } from './analytics.types';
import {
  buildDailyClicks,
  getPeriodBounds,
  mapAnalytics,
  toSafeCount,
} from './analytics.utils';

describe('analytics calculations', () => {
  const linkId = '11111111-1111-4111-8111-111111111111';
  const bounds = getPeriodBounds(new Date('2026-11-26T13:45:00.000Z'));
  const metric = (
    kind: AnalyticsMetricRow['kind'],
    clicks: bigint,
    label: string | null = null,
    uniqueVisitors = 0n,
  ): AnalyticsMetricRow => ({ kind, label, clicks, uniqueVisitors });
  const summaries = [metric('total', 7n), metric('window', 3n, null, 2n)];

  it.each([
    ['2026-11-26T13:45:00Z', '2026-10-28T00:00:00.000Z'],
    ['2027-01-01T00:00:00Z', '2026-12-03T00:00:00.000Z'],
    ['2024-03-01T08:00:00Z', '2024-02-01T00:00:00.000Z'],
    ['2025-03-01T08:00:00Z', '2025-01-31T00:00:00.000Z'],
    ['2026-11-26T23:30:00-05:00', '2026-10-29T00:00:00.000Z'],
  ])('uses 30 UTC calendar dates for %s', (timestamp, expectedFrom) => {
    const asOf = new Date(timestamp);
    const original = asOf.toISOString();
    const period = getPeriodBounds(asOf);
    expect(period.from.toISOString()).toBe(expectedFrom);
    expect(period.to.toISOString()).toBe(original);
    expect(asOf.toISOString()).toBe(original);
    expect(period.to).not.toBe(asOf);
  });

  it('rejects an invalid internal timestamp', () => {
    expect(() => getPeriodBounds(new Date('invalid'))).toThrow(RangeError);
  });

  it('returns exactly 30 chronological days and fills missing days with zero', () => {
    const daily = buildDailyClicks(bounds, [
      metric('daily', 2n, '2026-11-26'),
      metric('daily', 1n, '2026-10-28'),
    ]);
    expect(daily).toHaveLength(30);
    expect(daily[0]).toEqual({ date: '2026-10-28', clicks: 1 });
    expect(daily[1]).toEqual({ date: '2026-10-29', clicks: 0 });
    expect(daily[29]).toEqual({ date: '2026-11-26', clicks: 2 });
    expect(daily.reduce((sum, day) => sum + day.clicks, 0)).toBe(3);
  });

  it('uses UTC, not DST-dependent local days', () => {
    const period = getPeriodBounds(new Date('2026-03-08T01:30:00-05:00'));
    const daily = buildDailyClicks(period, []);
    for (let index = 1; index < daily.length; index++) {
      expect(
        Date.parse(daily[index]!.date) - Date.parse(daily[index - 1]!.date),
      ).toBe(MILLISECONDS_PER_DAY);
    }
  });

  it('handles an owned link with no clicks without inventing unique visitors', () => {
    const response = mapAnalytics(linkId, bounds, [
      metric('total', 0n),
      metric('window', 0n),
    ]);
    expect(response).toMatchObject({
      linkId,
      totalClicks: 0,
      clicksLast30Days: 0,
      uniqueVisitorsLast30Days: 0,
      countries: [],
      topReferrers: [],
    });
    expect(response.dailyClicks).toHaveLength(30);
    expect(response.dailyClicks.every((day) => day.clicks === 0)).toBe(true);
    expect(response.devices).toEqual(
      DEVICE_TYPES.map((device) => ({ device, clicks: 0 })),
    );
  });

  it('separates lifetime/window totals and returns the correct period', () => {
    const response = mapAnalytics(linkId, bounds, summaries);
    expect(response).toMatchObject({
      totalClicks: 7,
      clicksLast30Days: 3,
      uniqueVisitorsLast30Days: 2,
      period: {
        timezone: 'UTC',
        days: 30,
        from: '2026-10-28T00:00:00.000Z',
        to: '2026-11-26T13:45:00.000Z',
      },
    });
    expect(() => JSON.stringify(response)).not.toThrow();
  });

  it('sorts breakdowns by count, with deterministic null/label tie-breaking', () => {
    const response = mapAnalytics(linkId, bounds, [
      ...summaries,
      metric('referrer', 1n, 'z.example'),
      metric('referrer', 1n, null),
      metric('referrer', 1n, 'a.example'),
      metric('country', 1n, 'US'),
      metric('country', 1n, null),
      metric('country', 1n, 'ID'),
      metric('device', 2n, 'mobile'),
      metric('device', 1n, 'unknown'),
    ]);
    expect(response.topReferrers).toEqual([
      { referrer: null, clicks: 1 },
      { referrer: 'a.example', clicks: 1 },
      { referrer: 'z.example', clicks: 1 },
    ]);
    expect(response.countries).toEqual([
      { country: null, clicks: 1 },
      { country: 'ID', clicks: 1 },
      { country: 'US', clicks: 1 },
    ]);
    expect(response.devices.reduce((sum, item) => sum + item.clicks, 0)).toBe(
      3,
    );
    expect(response.devices.map((item) => item.device)).toEqual([
      ...DEVICE_TYPES,
    ]);
  });

  it('limits top referrers to ten without mutating the original rows', () => {
    const rows = [
      ...summaries,
      ...Array.from({ length: 12 }, (_, index) =>
        metric('referrer', BigInt(index + 1), `site${index}.example`),
      ),
    ];
    const response = mapAnalytics(linkId, bounds, rows);
    expect(response.topReferrers).toHaveLength(10);
    expect(response.topReferrers[0]).toEqual({
      referrer: 'site11.example',
      clicks: 12,
    });
    expect(response.topReferrers[9]?.clicks).toBe(3);
    expect(rows).toHaveLength(14);
  });

  it.each([0n, 1n, BigInt(Number.MAX_SAFE_INTEGER)])(
    'converts PostgreSQL count %s to a safe JSON number',
    (value) => {
      expect(toSafeCount(value)).toBe(Number(value));
    },
  );

  it.each([-1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])(
    'rejects invalid or unsafe count %s instead of silently losing precision',
    (value) => {
      expect(() => toSafeCount(value)).toThrow(RangeError);
    },
  );

  it('fails loudly on a malformed internal aggregate instead of returning false zeroes', () => {
    expect(() => mapAnalytics(linkId, bounds, [metric('total', 1n)])).toThrow(
      'Analytics summary rows are missing',
    );
  });
});
