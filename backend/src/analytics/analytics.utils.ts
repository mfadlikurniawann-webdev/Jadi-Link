import {
  ANALYTICS_DAYS,
  DEVICE_TYPES,
  MILLISECONDS_PER_DAY,
  TOP_REFERRERS_LIMIT,
} from './analytics.constants';
import type {
  AnalyticsMetricRow,
  AnalyticsPeriodBounds,
} from './analytics.types';
import {
  AnalyticsPeriodDto,
  AnalyticsResponseDto,
  CountryClicksDto,
  DailyClicksDto,
  DeviceClicksDto,
  ReferrerClicksDto,
} from './dto/analytics-response.dto';

export function getPeriodBounds(asOf: Date): AnalyticsPeriodBounds {
  if (!Number.isFinite(asOf.getTime())) {
    throw new RangeError('Invalid analytics timestamp');
  }
  const from = new Date(asOf);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (ANALYTICS_DAYS - 1));
  return { from, to: new Date(asOf) };
}

export function toSafeCount(value: bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Analytics count is outside the safe integer range');
  }
  return count;
}

export function buildDailyClicks(
  bounds: AnalyticsPeriodBounds,
  rows: AnalyticsMetricRow[],
): DailyClicksDto[] {
  const counts = new Map(
    rows
      .filter((row) => row.kind === 'daily')
      .map((row) => [row.label, toSafeCount(row.clicks)]),
  );
  return Array.from({ length: ANALYTICS_DAYS }, (_, index) => {
    // UTC calendar days have no daylight-saving offset changes.
    const date = new Date(bounds.from.getTime() + index * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    return new DailyClicksDto(date, counts.get(date) ?? 0);
  });
}

function compareMetrics(a: AnalyticsMetricRow, b: AnalyticsMetricRow): number {
  const countOrder = toSafeCount(b.clicks) - toSafeCount(a.clicks);
  if (countOrder !== 0) return countOrder;
  if (a.label === b.label) return 0;
  if (a.label === null) return -1;
  if (b.label === null) return 1;
  // Match PostgreSQL COLLATE "C", not the machine's default locale.
  return a.label < b.label ? -1 : 1;
}

export function mapAnalytics(
  linkId: string,
  bounds: AnalyticsPeriodBounds,
  rows: AnalyticsMetricRow[],
): AnalyticsResponseDto {
  const total = rows.find((row) => row.kind === 'total');
  const window = rows.find((row) => row.kind === 'window');
  if (!total || !window) {
    throw new Error('Analytics summary rows are missing');
  }
  const devices = new Map(
    rows
      .filter((row) => row.kind === 'device')
      .map((row) => [row.label, toSafeCount(row.clicks)]),
  );
  return new AnalyticsResponseDto(
    linkId,
    new AnalyticsPeriodDto(bounds),
    toSafeCount(total.clicks),
    toSafeCount(window.clicks),
    toSafeCount(window.uniqueVisitors),
    buildDailyClicks(bounds, rows),
    rows
      .filter((row) => row.kind === 'referrer')
      .sort(compareMetrics)
      .slice(0, TOP_REFERRERS_LIMIT)
      .map((row) => new ReferrerClicksDto(row.label, toSafeCount(row.clicks))),
    rows
      .filter((row) => row.kind === 'country')
      .sort(compareMetrics)
      .map((row) => new CountryClicksDto(row.label, toSafeCount(row.clicks))),
    DEVICE_TYPES.map(
      (device) => new DeviceClicksDto(device, devices.get(device) ?? 0),
    ),
  );
}
