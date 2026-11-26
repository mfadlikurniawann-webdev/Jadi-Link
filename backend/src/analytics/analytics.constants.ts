export const ANALYTICS_DAYS = 30;
export const TOP_REFERRERS_LIMIT = 10;
export const MILLISECONDS_PER_DAY = 86_400_000;
export const DEVICE_TYPES = [
  'desktop',
  'mobile',
  'tablet',
  'bot',
  'unknown',
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];
