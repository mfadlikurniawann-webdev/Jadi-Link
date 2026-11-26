import { ANALYTICS_DAYS } from '../analytics.constants';
import type { DeviceType } from '../analytics.constants';
import type { AnalyticsPeriodBounds } from '../analytics.types';

export class AnalyticsPeriodDto {
  readonly timezone = 'UTC';
  readonly days = ANALYTICS_DAYS;
  readonly from: string;
  readonly to: string;

  constructor(bounds: AnalyticsPeriodBounds) {
    this.from = bounds.from.toISOString();
    this.to = bounds.to.toISOString();
  }
}

export class DailyClicksDto {
  constructor(
    readonly date: string,
    readonly clicks: number,
  ) {}
}

export class ReferrerClicksDto {
  constructor(
    readonly referrer: string | null,
    readonly clicks: number,
  ) {}
}

export class CountryClicksDto {
  constructor(
    readonly country: string | null,
    readonly clicks: number,
  ) {}
}

export class DeviceClicksDto {
  constructor(
    readonly device: DeviceType,
    readonly clicks: number,
  ) {}
}

export class AnalyticsResponseDto {
  constructor(
    readonly linkId: string,
    readonly period: AnalyticsPeriodDto,
    readonly totalClicks: number,
    readonly clicksLast30Days: number,
    readonly uniqueVisitorsLast30Days: number,
    readonly dailyClicks: DailyClicksDto[],
    readonly topReferrers: ReferrerClicksDto[],
    readonly countries: CountryClicksDto[],
    readonly devices: DeviceClicksDto[],
  ) {}
}
