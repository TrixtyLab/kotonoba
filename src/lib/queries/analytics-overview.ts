import { getDb } from "@/lib/db";
import { analytics, analyticsSegments } from "@/lib/db/schema";
import {
  buildAnalyticsFilterConditions,
  cleanReferrerDomain,
  type AnalyticsFilters,
  type DateRangeBounds,
} from "@/lib/analytics/query";
import { and, desc, eq, like, sql } from "drizzle-orm";

/** Aggregates top paths, referrers, countries, and daily chart buckets for analytics overview. */
export function getAnalyticsOverviewBreakdowns(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);

  const topPaths = db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  const rawReferrers = db
    .select({ referrer: analytics.referrer, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const referrerMap = new Map<string, number>();
  for (const r of rawReferrers) {
    const domain = cleanReferrerDomain(r.referrer);
    referrerMap.set(domain, (referrerMap.get(domain) || 0) + r.count);
  }
  const topReferrers = Array.from(referrerMap.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topCountries = db
    .select({ country: analytics.country, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.country)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  const dailyHits = db
    .select({
      dayString: sql<string>`strftime('%Y-%m-%d', datetime(created_at, 'unixepoch'))`,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(sql`strftime('%Y-%m-%d', datetime(created_at, 'unixepoch'))`)
    .all();

  const dailyCountMap = new Map<string, number>();
  for (const row of dailyHits) {
    if (row.dayString) dailyCountMap.set(row.dayString, row.count);
  }

  return { topPaths, topReferrers, topCountries, dailyCountMap };
}

function summarizePeriodSessions(
  rows: Array<{ pageviews: number; maxDuration: number }>
): { bounceRate: number; avgDuration: number } {
  const totalSessions = rows.length;
  if (totalSessions === 0) return { bounceRate: 0, avgDuration: 0 };
  const bounced = rows.filter((s) => s.pageviews === 1 || s.maxDuration < 10).length;
  const durationSum = rows.reduce((acc, s) => acc + s.maxDuration, 0);
  return {
    bounceRate: Math.round((bounced / totalSessions) * 100),
    avgDuration: Math.round(durationSum / totalSessions),
  };
}

/** Compares active period metrics and per-path volume deltas against the immediately preceding window. */
export function getAnalyticsComparisonData(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const conditionA = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);
  const conditionB = buildAnalyticsFilterConditions(
    siteId,
    bounds.previousStart,
    bounds.previousEnd,
    filters
  );

  const hitsA = db.select({ count: sql<number>`count(*)` }).from(analytics).where(conditionA).get()?.count || 0;
  const visitorsA =
    db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(conditionA).get()?.count || 0;
  const hitsB = db.select({ count: sql<number>`count(*)` }).from(analytics).where(conditionB).get()?.count || 0;
  const visitorsB =
    db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(conditionB).get()?.count || 0;

  const sessionsA = db
    .select({ pageviews: sql<number>`count(*)`, maxDuration: sql<number>`coalesce(max(time_on_page), 0)` })
    .from(analytics)
    .where(conditionA)
    .groupBy(sql`coalesce(nullif(session_id, ''), ip_hash)`)
    .all();

  const sessionsB = db
    .select({ pageviews: sql<number>`count(*)`, maxDuration: sql<number>`coalesce(max(time_on_page), 0)` })
    .from(analytics)
    .where(conditionB)
    .groupBy(sql`coalesce(nullif(session_id, ''), ip_hash)`)
    .all();

  const pathsA = db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(conditionA)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all();

  const pathsBMap = new Map<string, number>();
  for (const p of db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(conditionB)
    .groupBy(analytics.path)
    .all()) {
    pathsBMap.set(p.path, p.count);
  }

  return {
    hitsA,
    visitorsA,
    hitsB,
    visitorsB,
    ...(() => {
      const a = summarizePeriodSessions(sessionsA);
      const b = summarizePeriodSessions(sessionsB);
      return {
        bounceRateA: a.bounceRate,
        avgDurationA: a.avgDuration,
        bounceRateB: b.bounceRate,
        avgDurationB: b.avgDuration,
      };
    })(),
    pathsA,
    pathsBMap,
  };
}

/** Queries recorded 1x1 tracking pixel hits grouped by campaign token for a tenant. */
export function getRecordedPixelHits(siteId: string) {
  return getDb()
    .select({
      campaign: sql<string>`coalesce(nullif(utm_campaign, ''), replace(path, '/pixel/', ''))`,
      impressions: sql<number>`count(*)`,
      uniqueReaders: sql<number>`count(distinct ip_hash)`,
      lastHitEpoch: sql<number>`max(created_at)`,
    })
    .from(analytics)
    .where(and(eq(analytics.siteId, siteId), like(analytics.path, "/pixel/%")))
    .groupBy(sql`coalesce(nullif(utm_campaign, ''), replace(path, '/pixel/', ''))`)
    .orderBy(desc(sql`count(*)`))
    .all();
}

/** Lists saved analytics filter segments for a tenant site. */
export function listSavedAnalyticsSegments(siteId: string) {
  return getDb()
    .select({
      id: analyticsSegments.id,
      name: analyticsSegments.name,
      filters: analyticsSegments.filters,
      createdAt: analyticsSegments.createdAt,
    })
    .from(analyticsSegments)
    .where(eq(analyticsSegments.siteId, siteId))
    .orderBy(desc(analyticsSegments.createdAt))
    .all();
}
