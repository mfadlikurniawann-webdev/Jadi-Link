import { ApiProperty } from '@nestjs/swagger';
import { ANALYTICS_DAYS, DEVICE_TYPES } from '../analytics.constants';
import type { DeviceType } from '../analytics.constants';
import type { AnalyticsPeriodBounds } from '../analytics.types';

const countSchema = {
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
} as const;

export class AnalyticsPeriodDto {
  @ApiProperty({ enum: ['UTC'] })
  readonly timezone = 'UTC';
  @ApiProperty({ type: 'integer', enum: [ANALYTICS_DAYS] })
  readonly days = ANALYTICS_DAYS;
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive UTC midnight, 29 days before today.',
  })
  readonly from: string;
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive snapshot timestamp; today is partial.',
  })
  readonly to: string;

  constructor(bounds: AnalyticsPeriodBounds) {
    this.from = bounds.from.toISOString();
    this.to = bounds.to.toISOString();
  }
}

export class DailyClicksDto {
  @ApiProperty({ format: 'date', example: '2026-11-26' })
  readonly date: string;

  @ApiProperty(countSchema)
  readonly clicks: number;

  constructor(date: string, clicks: number) {
    this.date = date;
    this.clicks = clicks;
  }
}

export class ReferrerClicksDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'search.example',
    description: 'Hostname only; null means direct/unknown.',
  })
  readonly referrer: string | null;

  @ApiProperty(countSchema)
  readonly clicks: number;

  constructor(referrer: string | null, clicks: number) {
    this.referrer = referrer;
    this.clicks = clicks;
  }
}

export class CountryClicksDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'ID',
    description: 'Two-letter country from Cloudflare, or null.',
  })
  readonly country: string | null;

  @ApiProperty(countSchema)
  readonly clicks: number;

  constructor(country: string | null, clicks: number) {
    this.country = country;
    this.clicks = clicks;
  }
}

export class DeviceClicksDto {
  @ApiProperty({ enum: [...DEVICE_TYPES] })
  readonly device: DeviceType;

  @ApiProperty(countSchema)
  readonly clicks: number;

  constructor(device: DeviceType, clicks: number) {
    this.device = device;
    this.clicks = clicks;
  }
}

export class AnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly linkId: string;

  @ApiProperty({ type: () => AnalyticsPeriodDto })
  readonly period: AnalyticsPeriodDto;

  @ApiProperty({
    ...countSchema,
    description:
      'All persisted clicks through period.to, including history before the window.',
  })
  readonly totalClicks: number;

  @ApiProperty(countSchema)
  readonly clicksLast30Days: number;

  @ApiProperty({
    ...countSchema,
    description:
      'Distinct nonempty visitor hashes in the window; not a count of people.',
  })
  readonly uniqueVisitorsLast30Days: number;

  @ApiProperty({
    type: () => [DailyClicksDto],
    minItems: ANALYTICS_DAYS,
    maxItems: ANALYTICS_DAYS,
  })
  readonly dailyClicks: DailyClicksDto[];

  @ApiProperty({ type: () => [ReferrerClicksDto], maxItems: 10 })
  readonly topReferrers: ReferrerClicksDto[];

  @ApiProperty({ type: () => [CountryClicksDto] })
  readonly countries: CountryClicksDto[];

  @ApiProperty({ type: () => [DeviceClicksDto], minItems: 5, maxItems: 5 })
  readonly devices: DeviceClicksDto[];

  constructor(
    linkId: string,
    period: AnalyticsPeriodDto,
    totalClicks: number,
    clicksLast30Days: number,
    uniqueVisitorsLast30Days: number,
    dailyClicks: DailyClicksDto[],
    topReferrers: ReferrerClicksDto[],
    countries: CountryClicksDto[],
    devices: DeviceClicksDto[],
  ) {
    this.linkId = linkId;
    this.period = period;
    this.totalClicks = totalClicks;
    this.clicksLast30Days = clicksLast30Days;
    this.uniqueVisitorsLast30Days = uniqueVisitorsLast30Days;
    this.dailyClicks = dailyClicks;
    this.topReferrers = topReferrers;
    this.countries = countries;
    this.devices = devices;
  }
}
