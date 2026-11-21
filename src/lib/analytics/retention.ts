import { getDb } from "@/lib/db";
import { analytics, analyticsDaily } from "@/lib/db/schema";
import { getAnalyticsRetentionDays } from "@/lib/config/env";
import { isAnalyticsPruningEnabled } from "@/lib/config/features";
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";

/** Weekly retention cohort matrix row. */
export interface RetentionCohortRow {
  cohortIndex: number;
  size: number;
  w0: number;
  w1: number;
  w2: number;
  w3: number;
}

/** Aggregated visitor retention metrics for a site. */
export interface RetentionSummary {
  totalVisitors: number;
  returningVisitors: number;
  newVisitors: number;
  retentionRate: number;
  cohorts: RetentionCohortRow[];
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEpochMs(rawEpoch: number): number {
  return rawEpoch < 1e12 ? rawEpoch * 1000 : rawEpoch;
}

function groupHitsByVisitor(allHits: Array<{ ipHash: string; createdEpoch: number }>): Map<string, number[]> {
  const hitsByVisitor = new Map<string, number[]>();
  for (const hit of allHits) {
    const list = hitsByVisitor.get(hit.ipHash);
    if (list) list.push(hit.createdEpoch);
    else hitsByVisitor.set(hit.ipHash, [hit.createdEpoch]);
  }
  return hitsByVisitor;
}

function buildVisitorCohortBuckets(
  visitorVisits: Array<{ ipHash: string; firstVisitEpoch: number }>,
  nowMs: number
): { visitorFirstSeenMap: Map<string, number>; cohortMap: Map<number, Set<string>> } {
  const visitorFirstSeenMap = new Map<string, number>();
  const cohortMap = new Map<number, Set<string>>();

  for (const v of visitorVisits) {
    const firstEpochMs = normalizeEpochMs(v.firstVisitEpoch);
    visitorFirstSeenMap.set(v.ipHash, firstEpochMs);
    const ageWeeks = Math.floor((nowMs - firstEpochMs) / ONE_WEEK_MS);
    if (ageWeeks >= 0 && ageWeeks < 4) {
      let bucket = cohortMap.get(ageWeeks);
      if (!bucket) {
        bucket = new Set();
        cohortMap.set(ageWeeks, bucket);
      }
      bucket.add(v.ipHash);
    }
  }

  return { visitorFirstSeenMap, cohortMap };
}

function getVisitorReturnWeeks(userHits: number[], firstEpochMs: number) {
  let w1 = false;
  let w2 = false;
  let w3 = false;
  for (const rawEpoch of userHits) {
    const diff = normalizeEpochMs(rawEpoch) - firstEpochMs;
    if (diff >= ONE_WEEK_MS && diff < 2 * ONE_WEEK_MS) w1 = true;
    else if (diff >= 2 * ONE_WEEK_MS && diff < 3 * ONE_WEEK_MS) w2 = true;
    else if (diff >= 3 * ONE_WEEK_MS && diff < 4 * ONE_WEEK_MS) w3 = true;
  }
  return { w1, w2, w3 };
}

function buildCohortRow(
  cohortIndex: number,
  visitorsInCohort: Set<string>,
  visitorFirstSeenMap: Map<string, number>,
  hitsByVisitor: Map<string, number[]>
): RetentionCohortRow {
  const size = visitorsInCohort.size;
  if (size === 0) return { cohortIndex, size: 0, w0: 0, w1: 0, w2: 0, w3: 0 };

  let w1Hits = 0;
  let w2Hits = 0;
  let w3Hits = 0;
  for (const ip of visitorsInCohort) {
    const { w1, w2, w3 } = getVisitorReturnWeeks(hitsByVisitor.get(ip) || [], visitorFirstSeenMap.get(ip) || 0);
    if (w1) w1Hits++;
    if (w2) w2Hits++;
    if (w3) w3Hits++;
  }

  return {
    cohortIndex,
    size,
    w0: 100,
    w1: Math.round((w1Hits / size) * 100),
    w2: Math.round((w2Hits / size) * 100),
    w3: Math.round((w3Hits / size) * 100),
  };
}

/**
 * Computes visitor retention ratios and 4-week cohort retention percentages for a tenant site.
 *
 * @param siteId - Tenant site identifier.
 * @param nowMs - Reference epoch in milliseconds (defaults to current time).
 * @returns Aggregated retention summary and weekly cohort rows.
 */
export function getSiteRetentionSummary(
  siteId: string,
  nowMs: number = Date.now()
): RetentionSummary {
  const db = getDb();

  const visitorVisits = db
    .select({
      ipHash: analytics.ipHash,
      distinctDays: sql<number>`count(distinct strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')))`,
      firstVisitEpoch: sql<number>`min(created_at)`,
    })
    .from(analytics)
    .where(eq(analytics.siteId, siteId))
    .groupBy(analytics.ipHash)
    .all();

  const totalVisitors = visitorVisits.length;
  const returningVisitors = visitorVisits.filter((v) => v.distinctDays > 1).length;
  const newVisitors = totalVisitors - returningVisitors;
  const retentionRate = totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0;

  const allHits = db
    .select({ ipHash: analytics.ipHash, createdEpoch: sql<number>`created_at` })
    .from(analytics)
    .where(eq(analytics.siteId, siteId))
    .all();

  const hitsByVisitor = groupHitsByVisitor(allHits);
  const { visitorFirstSeenMap, cohortMap } = buildVisitorCohortBuckets(visitorVisits, nowMs);
  const cohorts = [3, 2, 1, 0].map((c) =>
    buildCohortRow(c, cohortMap.get(c) || new Set<string>(), visitorFirstSeenMap, hitsByVisitor)
  );

  return { totalVisitors, returningVisitors, newVisitors, retentionRate, cohorts };
}

/** Pre-aggregated daily analytics summary record. */
export interface DailyAnalyticsSummaryRow {
  siteId: string;
  date: string;
  path: string;
  country: string;
  device: string;
  views: number;
  uniqueVisitors: number;
}

/**
 * Idempotently aggregates raw analytics hits into `analytics_daily` grouped by `(siteId, date, path, country, device)`.
 * Safe to invoke before pruning raw rows so historical metrics survive retention cleanup.
 *
 * @param options - Optional tenant filter (`siteId`) and upper cutoff epoch (`upToDateMs`).
 * @returns Number of daily summary buckets upserted.
 */
export function aggregateDailyAnalytics(
  options: { siteId?: string; upToDateMs?: number } = {}
): number {
  const db = getDb();
  const cutoffSec =
    options.upToDateMs !== undefined ? Math.floor(options.upToDateMs / 1000) : null;

  const siteFilter = options.siteId ? sql`AND site_id = ${options.siteId}` : sql``;
  const dateFilter =
    cutoffSec !== null
      ? sql`AND (CASE WHEN created_at < 1000000000000 THEN created_at ELSE CAST(created_at / 1000 AS INTEGER) END) < ${cutoffSec}`
      : sql``;

  const rows = db.all<{
    siteId: string;
    date: string;
    path: string;
    country: string;
    device: string;
    views: number;
    uniqueVisitors: number;
  }>(sql`
    SELECT
      site_id AS siteId,
      strftime('%Y-%m-%d', datetime(CASE WHEN created_at < 1000000000000 THEN created_at ELSE CAST(created_at / 1000 AS INTEGER) END, 'unixepoch')) AS date,
      path AS path,
      COALESCE(country, '') AS country,
      COALESCE(NULLIF(device, ''), 'desktop') AS device,
      COUNT(*) AS views,
      COUNT(DISTINCT ip_hash) AS uniqueVisitors
    FROM analytics
    WHERE 1 = 1
      ${siteFilter}
      ${dateFilter}
    GROUP BY site_id, date, path, COALESCE(country, ''), COALESCE(NULLIF(device, ''), 'desktop')
  `);

  let upserted = 0;
  for (const row of rows) {
    if (!row.date) continue;
    db.run(sql`
      INSERT INTO analytics_daily (site_id, date, path, country, device, views, unique_visitors)
      VALUES (${row.siteId}, ${row.date}, ${row.path}, ${row.country}, ${row.device}, ${row.views}, ${row.uniqueVisitors})
      ON CONFLICT(site_id, date, path, country, device) DO UPDATE SET
        views = MAX(analytics_daily.views, excluded.views),
        unique_visitors = MAX(analytics_daily.unique_visitors, excluded.unique_visitors)
    `);
    upserted++;
  }

  return upserted;
}

/**
 * Queries pre-aggregated daily analytics rollups for a tenant site over an optional UTC date range (`YYYY-MM-DD`).
 */
export function getDailyAnalyticsSummary(
  siteId: string,
  options: { fromDate?: string; toDate?: string } = {}
): DailyAnalyticsSummaryRow[] {
  const db = getDb();
  const conditions = [eq(analyticsDaily.siteId, siteId)];
  if (options.fromDate) {
    conditions.push(gte(analyticsDaily.date, options.fromDate));
  }
  if (options.toDate) {
    conditions.push(lte(analyticsDaily.date, options.toDate));
  }

  return db
    .select({
      siteId: analyticsDaily.siteId,
      date: analyticsDaily.date,
      path: analyticsDaily.path,
      country: analyticsDaily.country,
      device: analyticsDaily.device,
      views: analyticsDaily.views,
      uniqueVisitors: analyticsDaily.uniqueVisitors,
    })
    .from(analyticsDaily)
    .where(and(...conditions))
    .orderBy(desc(analyticsDaily.date))
    .all();
}

/**
 * Pre-aggregates expiring analytics events into `analytics_daily` and deletes raw rows older than
 * the configured retention period (`ANALYTICS_RETENTION_DAYS`).
 * Passing `0` or a negative count disables pruning cleanly.
 *
 * @param retentionDays - Retention window in days (defaults to `ANALYTICS_RETENTION_DAYS` or 365).
 * @param nowMs - Optional epoch reference in milliseconds for deterministic tests.
 * @returns Number of deleted analytics rows.
 */
export function pruneExpiredAnalytics(
  retentionDays: number = getAnalyticsRetentionDays(),
  nowMs: number = Date.now()
): number {
  if (!isAnalyticsPruningEnabled() || !Number.isFinite(retentionDays) || retentionDays <= 0) {
    return 0;
  }

  const db = getDb();
  const cutoffMs = Math.floor((nowMs - retentionDays * 86_400_000) / 1000) * 1000;
  aggregateDailyAnalytics({ upToDateMs: cutoffMs });
  const cutoffDate = new Date(cutoffMs);
  const res = db.delete(analytics).where(lt(analytics.createdAt, cutoffDate)).run();
  return res.changes ?? 0;
}
