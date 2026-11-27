import { getDb } from "@/lib/db";
import { analytics, posts, pages, users } from "@/lib/db/schema";
import { eq, desc, sql, and, isNotNull, gte, or } from "drizzle-orm";
import { isDubConfigured, getDubLinkInfo, getDubLinks, type DubLinkItem } from "@/lib/dub";

/**
 * Normalizes raw HTTP Referrer strings into clean root domain names.
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

export interface ItemAnalyticsReport {
  isPost: boolean;
  item: {
    id: string;
    title: string;
    slug: string;
    status: string;
    locale: string;
    views: number;
    publishedAt: Date | null;
    createdAt: Date;
    coverImage: string | null;
    authorName: string | null;
    shortUrl?: string | null;
    dubLinkId?: string | null;
  };
  canonicalPath: string;
  editHref: string;
  totalPageViews: number;
  uniqueVisitors: number;
  topReferrers: Array<{ domain: string; count: number }>;
  topCountries: Array<{ country: string | null; count: number }>;
  deviceStats: Array<{ device: string | null; count: number }>;
  totalDevicesCount: number;
  browserStats: Array<{ browser: string; count: number }>;
  utmSources: Array<{ source: string | null; count: number }>;
  utmCampaigns: Array<{ campaign: string | null; count: number }>;
  recentHitsCount: number;
  dailyTimeline: Array<{ dateStr: string; label: string; count: number }>;
  maxDailyViews: number;
  recentLogs: Array<{
    id: number;
    path: string;
    device: string | null;
    browser: string | null;
    country: string | null;
    referrer: string | null;
    utmSource: string | null;
    utmCampaign: string | null;
    createdAt: Date;
  }>;
  isDubActive: boolean;
  dubInfo: DubLinkItem | null;
}

function findAnalyticsTargetItem(siteId: string, id: string) {
  const db = getDb();
  const post = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      locale: posts.locale,
      views: posts.views,
      shortUrl: posts.shortUrl,
      dubLinkId: posts.dubLinkId,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      coverImage: posts.coverImage,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.siteId, siteId), eq(posts.id, id)))
    .get();
  if (post) return { isPost: true as const, post, item: post };

  const page = db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      locale: pages.locale,
      views: pages.views,
      publishedAt: pages.publishedAt,
      createdAt: pages.createdAt,
      coverImage: pages.coverImage,
      authorName: users.displayName,
    })
    .from(pages)
    .leftJoin(users, eq(pages.authorId, users.id))
    .where(and(eq(pages.siteId, siteId), eq(pages.id, id)))
    .get();
  if (page) return { isPost: false as const, post: undefined, item: page };
  return null;
}

function buildTopReferrersList(rawReferrers: Array<{ referrer: string | null }>) {
  const referrerCounts: Record<string, number> = {};
  for (const row of rawReferrers) {
    const domain = cleanReferrerDomain(row.referrer);
    referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
  }
  return Object.entries(referrerCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
}

function buildDailyHitsTimeline(recentHits: Array<{ timestamp: Date | null }>, locale: string) {
  const dailyTimeline: Array<{ dateStr: string; label: string; count: number }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    dailyTimeline.push({
      dateStr: d.toISOString().split("T")[0],
      label: d.toLocaleDateString(locale, { day: "numeric", month: "short" }),
      count: 0,
    });
  }
  for (const hit of recentHits) {
    if (!hit.timestamp) continue;
    const hitDateStr = new Date(hit.timestamp).toISOString().split("T")[0];
    const bucket = dailyTimeline.find((entry) => entry.dateStr === hitDateStr);
    if (bucket) bucket.count++;
  }
  return {
    dailyTimeline,
    maxDailyViews: Math.max(1, ...dailyTimeline.map((d) => d.count)),
  };
}

async function resolvePostDubTelemetry(
  isDubActive: boolean,
  siteId: string,
  post?: { dubLinkId: string | null; shortUrl: string | null; slug: string }
): Promise<DubLinkItem | null> {
  if (!isDubActive || !post) return null;
  let dubInfo = post.dubLinkId ? await getDubLinkInfo(post.dubLinkId) : null;
  if (!dubInfo && post.shortUrl) {
    const allLinks = await getDubLinks({ siteId });
    dubInfo = allLinks.find((l) => l.shortLink === post.shortUrl || l.key === post.slug) || null;
  }
  return dubInfo;
}

/**
 * Aggregates granular analytics, device/browser breakdown, 14-day timeline, UTM attribution,
 * and optional Dub.co shortlink telemetry for a single article or static page.
 */
export async function getItemAnalyticsReport(
  siteId: string,
  id: string,
  locale: string
): Promise<ItemAnalyticsReport | null> {
  const target = findAnalyticsTargetItem(siteId, id);
  if (!target) return null;

  const db = getDb();
  const { isPost, post, item } = target;
  const canonicalPath = isPost ? `/entry/${item.slug}` : `/p/${item.slug}`;
  const editHref = isPost ? `/admin/posts/${item.id}` : `/admin/pages/${item.id}`;
  const itemCondition = and(
    eq(analytics.siteId, siteId),
    or(isPost ? eq(analytics.postId, item.id) : eq(analytics.pageId, item.id), eq(analytics.path, canonicalPath))
  );

  const totalPageViews = db.select({ count: sql<number>`count(*)` }).from(analytics).where(itemCondition).get()?.count || 0;
  const uniqueVisitors =
    db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(itemCondition).get()?.count || 0;
  const topReferrers = buildTopReferrersList(db.select({ referrer: analytics.referrer }).from(analytics).where(itemCondition).all());

  const topCountries = db
    .select({ country: analytics.country, count: sql<number>`count(*)` })
    .from(analytics)
    .where(itemCondition)
    .groupBy(analytics.country)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const deviceStats = db
    .select({ device: analytics.device, count: sql<number>`count(*)` })
    .from(analytics)
    .where(itemCondition)
    .groupBy(analytics.device)
    .all();
  const totalDevicesCount = deviceStats.reduce((acc, d) => acc + d.count, 0) || 1;

  const browserStats = db
    .select({
      browser: sql<string>`case when ${analytics.browser} is null or ${analytics.browser} = '' then 'Other' else ${analytics.browser} end`,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(itemCondition)
    .groupBy(sql`case when ${analytics.browser} is null or ${analytics.browser} = '' then 'Other' else ${analytics.browser} end`)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  const utmSources = db
    .select({ source: analytics.utmSource, count: sql<number>`count(*)` })
    .from(analytics)
    .where(and(itemCondition, isNotNull(analytics.utmSource)))
    .groupBy(analytics.utmSource)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const utmCampaigns = db
    .select({ campaign: analytics.utmCampaign, count: sql<number>`count(*)` })
    .from(analytics)
    .where(and(itemCondition, isNotNull(analytics.utmCampaign)))
    .groupBy(analytics.utmCampaign)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const recentHits = db
    .select({ timestamp: analytics.createdAt })
    .from(analytics)
    .where(and(itemCondition, gte(analytics.createdAt, fourteenDaysAgo)))
    .all();
  const { dailyTimeline, maxDailyViews } = buildDailyHitsTimeline(recentHits, locale);

  const recentLogs = db
    .select({
      id: analytics.id,
      path: analytics.path,
      device: analytics.device,
      browser: analytics.browser,
      country: analytics.country,
      referrer: analytics.referrer,
      utmSource: analytics.utmSource,
      utmCampaign: analytics.utmCampaign,
      createdAt: analytics.createdAt,
    })
    .from(analytics)
    .where(itemCondition)
    .orderBy(desc(analytics.createdAt))
    .limit(15)
    .all();

  const isDubActive = isDubConfigured();
  const dubInfo = await resolvePostDubTelemetry(isDubActive, siteId, post);

  return {
    isPost,
    item,
    canonicalPath,
    editHref,
    totalPageViews,
    uniqueVisitors,
    topReferrers,
    topCountries,
    deviceStats,
    totalDevicesCount,
    browserStats,
    utmSources,
    utmCampaigns,
    recentHitsCount: recentHits.length,
    dailyTimeline,
    maxDailyViews,
    recentLogs,
    isDubActive,
    dubInfo,
  };
}
