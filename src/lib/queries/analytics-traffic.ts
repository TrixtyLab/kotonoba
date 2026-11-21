import { getDb } from "@/lib/db";
import { analytics, pages, posts } from "@/lib/db/schema";
import {
  buildAnalyticsFilterConditions,
  type AnalyticsFilters,
  type DateRangeBounds,
} from "@/lib/analytics/query";
import { desc, eq, sql } from "drizzle-orm";

/** Aggregates path traffic, content slug mapping data, and session entry pages for `/admin/analytics/pages`. */
export function getAnalyticsContentTrafficData(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);

  const sitePosts = db
    .select({ id: posts.id, title: posts.title, slug: posts.slug })
    .from(posts)
    .where(eq(posts.siteId, siteId))
    .all();

  const sitePages = db
    .select({ id: pages.id, title: pages.title, slug: pages.slug })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .all();

  const pathStats = db
    .select({
      path: analytics.path,
      postId: sql<string | null>`max(post_id)`,
      pageId: sql<string | null>`max(page_id)`,
      views: sql<number>`count(*)`,
      uniqueVisitors: sql<number>`count(distinct ip_hash)`,
      avgTimeSeconds: sql<number>`coalesce(avg(nullif(time_on_page, 0)), 0)`,
      totalHits: sql<number>`count(*)`,
      bouncedHits: sql<number>`sum(case when time_on_page < 10 then 1 else 0 end)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(100)
    .all();

  const entryPages = db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(
      sql`${filterCondition} AND (analytics.id IN (
        SELECT id FROM analytics a2
        WHERE a2.site_id = ${siteId}
        GROUP BY coalesce(nullif(a2.session_id, ''), a2.ip_hash)
        HAVING min(a2.created_at)
      ))`
    )
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  return { sitePosts, sitePages, pathStats, entryPages };
}

function summarizeLatencyBuckets(loadTimes: number[]) {
  const sampleCount = loadTimes.length;
  if (sampleCount === 0) {
    return { sampleCount: 0, p50: 0, p75: 0, p95: 0, avg: 0, fastCount: 0, moderateCount: 0, slowCount: 0 };
  }

  let fastCount = 0;
  let moderateCount = 0;
  let slowCount = 0;
  let total = 0;

  for (const val of loadTimes) {
    total += val;
    if (val < 1000) fastCount++;
    else if (val <= 3000) moderateCount++;
    else slowCount++;
  }

  return {
    sampleCount,
    p50: loadTimes[Math.floor(sampleCount * 0.5)],
    p75: loadTimes[Math.floor(sampleCount * 0.75)],
    p95: loadTimes[Math.floor(sampleCount * 0.95)],
    avg: Math.round(total / sampleCount),
    fastCount,
    moderateCount,
    slowCount,
  };
}

/** Computes latency percentiles and slowest pages for `/admin/analytics/performance`. */
export function getAnalyticsPerformanceData(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);

  const loadTimes = db
    .select({ loadTime: analytics.loadTime })
    .from(analytics)
    .where(sql`${filterCondition} AND load_time IS NOT NULL AND load_time > 0`)
    .orderBy(analytics.loadTime)
    .all()
    .map((r) => r.loadTime as number);

  const slowestHits = db
    .select({
      path: analytics.path,
      avgLoadTime: sql<number>`round(avg(load_time))`,
      samples: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND load_time IS NOT NULL AND load_time > 0`)
    .groupBy(analytics.path)
    .orderBy(desc(sql`avg(load_time)`))
    .limit(10)
    .all();

  return { ...summarizeLatencyBuckets(loadTimes), slowestHits };
}

/** Queries referrer channels and UTM attribution metrics for `/admin/analytics/sources`. */
export function getAnalyticsSourcesData(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);

  const rawReferrers = db
    .select({ referrer: analytics.referrer, utmMedium: analytics.utmMedium, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.referrer, analytics.utmMedium)
    .all();

  const utmCampaigns = db
    .select({
      name: analytics.utmCampaign,
      views: sql<number>`count(*)`,
      visitors: sql<number>`count(distinct ip_hash)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND utm_campaign IS NOT NULL AND utm_campaign != ''`)
    .groupBy(analytics.utmCampaign)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all();

  const utmSources = db
    .select({
      name: analytics.utmSource,
      views: sql<number>`count(*)`,
      visitors: sql<number>`count(distinct ip_hash)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND utm_source IS NOT NULL AND utm_source != ''`)
    .groupBy(analytics.utmSource)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all();

  return { rawReferrers, utmCampaigns, utmSources };
}

/** Queries device, OS, browser, language, screen resolution, and geo breakdowns for `/admin/analytics/visitors`. */
export function getAnalyticsVisitorsData(
  siteId: string,
  bounds: DateRangeBounds,
  filters: AnalyticsFilters
) {
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);

  const deviceHits = db
    .select({ device: analytics.device, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.device)
    .all();

  const osHits = db
    .select({ os: analytics.os, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.os)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const browserHits = db
    .select({ browser: analytics.browser, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.browser)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const langHits = db
    .select({ language: analytics.language, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.language)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const screenHits = db
    .select({ width: analytics.screenWidth, height: analytics.screenHeight, count: sql<number>`count(*)` })
    .from(analytics)
    .where(sql`${filterCondition} AND screen_width IS NOT NULL AND screen_height IS NOT NULL`)
    .groupBy(analytics.screenWidth, analytics.screenHeight)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();

  const geoHits = db
    .select({ country: analytics.country, city: analytics.city, count: sql<number>`count(*)` })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.country, analytics.city)
    .orderBy(desc(sql`count(*)`))
    .limit(20)
    .all();

  return { deviceHits, osHits, browserHits, langHits, screenHits, geoHits };
}
