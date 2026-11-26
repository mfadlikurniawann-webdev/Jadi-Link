export interface AnalyticsPeriodBounds {
  from: Date;
  to: Date;
}

// PostgreSQL COUNT(*) returns bigint. Only aggregated rows leave the database.
export interface AnalyticsMetricRow {
  kind: 'total' | 'window' | 'daily' | 'referrer' | 'country' | 'device';
  label: string | null;
  clicks: bigint;
  uniqueVisitors: bigint;
}
