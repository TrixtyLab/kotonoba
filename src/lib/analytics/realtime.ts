import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";

/**
 * Individual live activity item structure.
 */
export interface RealtimeFeedItem {
  id: number;
  path: string;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  createdAt: number;
}

/**
 * Payload containing live active visitor count, recent pageviews, and active page paths.
 */
export interface RealtimeDataResponse {
  activeVisitorsNow: number;
  recentHits: RealtimeFeedItem[];
  activePages: { path: string; count: number }[];
}

/**
 * Retrieves the latest stream of pageviews and concurrent visitors active within the preceding 5 minutes.
 * Executed directly on the database without going through Server Actions.
 *
 * @param {string} siteId - Target blog site unique identifier.
 * @returns {Promise<RealtimeDataResponse>} Current live activity telemetry data.
 */
export async function getRealtimeFeedData(siteId: string): Promise<RealtimeDataResponse> {
  const db = getDb();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const activeVisitors = db
    .select({ count: sql<number>`count(distinct coalesce(nullif(session_id, ''), ip_hash))` })
    .from(analytics)
    .where(and(eq(analytics.siteId, siteId), gte(analytics.createdAt, fiveMinutesAgo)))
    .get()?.count || 0;

  const activePages = db
    .select({
      path: analytics.path,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(and(eq(analytics.siteId, siteId), gte(analytics.createdAt, fiveMinutesAgo)))
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const recentRecords = db
    .select({
      id: analytics.id,
      path: analytics.path,
      country: analytics.country,
      device: analytics.device,
      browser: analytics.browser,
      os: analytics.os,
      referrer: analytics.referrer,
      createdAt: analytics.createdAt,
    })
    .from(analytics)
    .where(eq(analytics.siteId, siteId))
    .orderBy(desc(analytics.createdAt))
    .limit(30)
    .all();

  const recentHits: RealtimeFeedItem[] = recentRecords.map((r) => ({
    id: r.id,
    path: r.path,
    country: r.country,
    device: r.device,
    browser: r.browser,
    os: r.os,
    referrer: r.referrer,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
  }));

  return {
    activeVisitorsNow: activeVisitors,
    recentHits,
    activePages,
  };
}
