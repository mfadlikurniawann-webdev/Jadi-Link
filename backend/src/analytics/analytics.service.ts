import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TOP_REFERRERS_LIMIT } from './analytics.constants';
import type { AnalyticsMetricRow } from './analytics.types';
import { getPeriodBounds, mapAnalytics } from './analytics.utils';
import type { AnalyticsResponseDto } from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async forLink(userId: string, linkId: string): Promise<AnalyticsResponseDto> {
    const bounds = getPeriodBounds(new Date());
    // Prisma.sql parameterizes every value. One statement gives all aggregates
    // the same PostgreSQL snapshot, including the ownership check.
    const rows = await this.prisma.$queryRaw<AnalyticsMetricRow[]>(Prisma.sql`
      WITH owned_link AS MATERIALIZED (
        SELECT "id" FROM "Link"
        WHERE "id" = ${linkId}::uuid AND "userId" = ${userId}::uuid
      ),
      recent_clicks AS MATERIALIZED (
        SELECT
          c."clickedAt",
          NULLIF(c."referrer", '') AS referrer,
          CASE
            WHEN c."country" ~ '^[A-Z]{2}$' AND c."country" <> 'XX'
            THEN c."country" ELSE NULL
          END AS country,
          CASE
            WHEN c."device" IN ('desktop', 'mobile', 'tablet', 'bot')
            THEN c."device" ELSE 'unknown'
          END AS device,
          NULLIF(c."visitorHash", '') AS visitor_hash
        FROM "Click" c
        INNER JOIN owned_link l ON l."id" = c."linkId"
        WHERE c."clickedAt" >= ${bounds.from.toISOString()}::timestamptz
          AND c."clickedAt" <= ${bounds.to.toISOString()}::timestamptz
      ),
      total_metric AS (
        SELECT 'total'::text AS kind, NULL::text AS label,
          COUNT(*)::bigint AS clicks, 0::bigint AS "uniqueVisitors"
        FROM "Click" c
        INNER JOIN owned_link l ON l."id" = c."linkId"
        WHERE c."clickedAt" <= ${bounds.to.toISOString()}::timestamptz
      ),
      window_metric AS (
        SELECT 'window'::text AS kind, NULL::text AS label,
          COUNT(*)::bigint AS clicks,
          COUNT(DISTINCT visitor_hash)::bigint AS "uniqueVisitors"
        FROM recent_clicks
      ),
      daily_metrics AS (
        SELECT 'daily'::text AS kind,
          to_char("clickedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS label,
          COUNT(*)::bigint AS clicks, 0::bigint AS "uniqueVisitors"
        FROM recent_clicks
        GROUP BY to_char("clickedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ),
      referrer_metrics AS (
        SELECT 'referrer'::text AS kind, referrer AS label,
          COUNT(*)::bigint AS clicks, 0::bigint AS "uniqueVisitors"
        FROM recent_clicks
        GROUP BY referrer
        ORDER BY COUNT(*) DESC, referrer COLLATE "C" ASC NULLS FIRST
        LIMIT ${TOP_REFERRERS_LIMIT}
      ),
      country_metrics AS (
        SELECT 'country'::text AS kind, country AS label,
          COUNT(*)::bigint AS clicks, 0::bigint AS "uniqueVisitors"
        FROM recent_clicks GROUP BY country
      ),
      device_metrics AS (
        SELECT 'device'::text AS kind, device AS label,
          COUNT(*)::bigint AS clicks, 0::bigint AS "uniqueVisitors"
        FROM recent_clicks GROUP BY device
      ),
      metrics AS (
        SELECT * FROM total_metric
        UNION ALL SELECT * FROM window_metric
        UNION ALL SELECT * FROM daily_metrics
        UNION ALL SELECT * FROM referrer_metrics
        UNION ALL SELECT * FROM country_metrics
        UNION ALL SELECT * FROM device_metrics
      )
      SELECT m.* FROM owned_link l CROSS JOIN metrics m
    `);
    // No owned_link row means zero results, even though COUNT(*) can return zero.
    if (rows.length === 0) throw new NotFoundException('Link not found');
    return mapAnalytics(linkId, bounds, rows);
  }
}
