import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { and, eq, gte, lte, sql, SQL } from "drizzle-orm";

export interface AnalyticsFilters {
  country?: string;
  browser?: string;
  device?: string;
  os?: string;
  path?: string;
  utmCampaign?: string;
  utmSource?: string;
}

export interface DateRangeBounds {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  days: number;
}

/**
 * Normalizes raw HTTP Referrer strings into clean root domain names.
 *
 * @param {string | null} rawReferrer - Raw HTTP Referrer string from analytics payload.
 * @returns {string} Clean root domain name or fallback description.
 */
export function cleanReferrerDomain(rawReferrer: string | null): string {
  if (!rawReferrer || !rawReferrer.trim()) return "Direct / Search";
  try {
    const url = new URL(rawReferrer.startsWith("http") ? rawReferrer : `https://${rawReferrer}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return rawReferrer.replace(/^https?:\/\//, "").split("/")[0] || "Direct";
  }
}

/**
 * Calculates start, end, and prior-period comparison boundaries for a selected preset identifier.
 *
 * @param {string | null} [preset] - Preset code ('24h', '7d', '30d', '90d', 'all').
 * @returns {DateRangeBounds} Normalized date range and comparison range object.
 */
export function getDateRangeBounds(preset?: string | null): DateRangeBounds {
  const now = new Date();
  const end = new Date(now);

  switch (preset) {
    case "24h": {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const previousEnd = new Date(start);
      return { start, end, previousStart, previousEnd, days: 1 };
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(start);
      return { start, end, previousStart, previousEnd, days: 7 };
    }
    case "90d": {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(start);
      return { start, end, previousStart, previousEnd, days: 90 };
    }
    case "all": {
      const start = new Date(0);
      const previousStart = new Date(0);
      const previousEnd = new Date(0);
      return { start, end, previousStart, previousEnd, days: 365 };
    }
    case "30d":
    default: {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(start);
      return { start, end, previousStart, previousEnd, days: 30 };
    }
  }
}

/**
 * Builds a compound Drizzle SQL WHERE condition enforcing tenant boundaries, time intervals, and filters.
 *
 * @param {string} siteId - Active blog site unique identifier.
 * @param {Date} [startDate] - Optional lower bound timestamp.
 * @param {Date} [endDate] - Optional upper bound timestamp.
 * @param {AnalyticsFilters} [filters] - Dimension filters.
 * @returns {SQL} Composed SQL where expression.
 */
const ANALYTICS_DIMENSION_FILTERS = [
  ["country", analytics.country],
  ["browser", analytics.browser],
  ["device", analytics.device],
  ["os", analytics.os],
  ["path", analytics.path],
  ["utmCampaign", analytics.utmCampaign],
  ["utmSource", analytics.utmSource],
] as const;

export function buildAnalyticsFilterConditions(
  siteId: string,
  startDate?: Date,
  endDate?: Date,
  filters?: AnalyticsFilters
): SQL {
  const conditions: SQL[] = [eq(analytics.siteId, siteId)];

  if (startDate && startDate.getTime() > 0) conditions.push(gte(analytics.createdAt, startDate));
  if (endDate) conditions.push(lte(analytics.createdAt, endDate));
  if (filters) {
    for (const [key, column] of ANALYTICS_DIMENSION_FILTERS) {
      const value = filters[key];
      if (value) conditions.push(eq(column, value));
    }
  }

  return and(...conditions)!;
}

function summarizeSessionMetrics(
  sessionStats: Array<{ pageviews: number; maxDuration: number }>
): { bounceRate: number; avgDurationSeconds: number } {
  const totalSessions = sessionStats.length;
  if (totalSessions === 0) return { bounceRate: 0, avgDurationSeconds: 0 };

  let bouncedSessions = 0;
  let totalDurationSeconds = 0;
  for (const s of sessionStats) {
    if (s.pageviews === 1 || s.maxDuration < 10) bouncedSessions++;
    totalDurationSeconds += s.maxDuration;
  }

  return {
    bounceRate: Math.round((bouncedSessions / totalSessions) * 100),
    avgDurationSeconds: Math.round(totalDurationSeconds / totalSessions),
  };
}

function computeGrowthPct(current: number, previous: number): number {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
}

/**
 * Aggregates core site metrics including total views, unique visitors, bounce rate, average duration, and load latency.
 *
 * @param {string} siteId - Blog site identifier.
 * @param {string | null} [rangePreset] - Range identifier.
 * @param {AnalyticsFilters} [filters] - Query dimension filters.
 * @returns {Promise<Object>} Aggregate statistics with period comparisons.
 */
export async function getAnalyticsOverviewMetrics(
  siteId: string,
  rangePreset?: string | null,
  filters?: AnalyticsFilters
) {
  const db = getDb();
  const bounds = getDateRangeBounds(rangePreset);
  const currentCondition = buildAnalyticsFilterConditions(siteId, bounds.start, bounds.end, filters);
  const previousCondition = buildAnalyticsFilterConditions(siteId, bounds.previousStart, bounds.previousEnd, filters);

  const currentHits = db.select({ count: sql<number>`count(*)` }).from(analytics).where(currentCondition).get()?.count || 0;
  const previousHits = db.select({ count: sql<number>`count(*)` }).from(analytics).where(previousCondition).get()?.count || 0;
  const currentVisitors =
    db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(currentCondition).get()?.count || 0;
  const previousVisitors =
    db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(previousCondition).get()?.count || 0;

  const sessionStats = db
    .select({
      sessionKey: sql<string>`coalesce(nullif(session_id, ''), ip_hash)`,
      pageviews: sql<number>`count(*)`,
      maxDuration: sql<number>`coalesce(max(time_on_page), 0)`,
      avgDuration: sql<number>`coalesce(avg(time_on_page), 0)`,
    })
    .from(analytics)
    .where(currentCondition)
    .groupBy(sql`coalesce(nullif(session_id, ''), ip_hash)`)
    .all();

  const { bounceRate, avgDurationSeconds } = summarizeSessionMetrics(sessionStats);
  const avgLoadTimeResult = db
    .select({ avgLoad: sql<number>`coalesce(avg(load_time), 0)` })
    .from(analytics)
    .where(and(currentCondition, sql`load_time IS NOT NULL AND load_time > 0`))
    .get();

  return {
    totalViews: currentHits,
    uniqueVisitors: currentVisitors,
    bounceRate,
    avgDurationSeconds,
    avgLoadTime: Math.round(avgLoadTimeResult?.avgLoad || 0),
    viewsGrowth: computeGrowthPct(currentHits, previousHits),
    visitorsGrowth: computeGrowthPct(currentVisitors, previousVisitors),
    bounds,
  };
}
