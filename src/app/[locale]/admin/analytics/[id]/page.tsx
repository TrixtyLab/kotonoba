import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics, posts, pages, users } from "@/lib/db/schema";
import { eq, desc, sql, and, isNotNull, gte, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Globe,
  Compass,
  Smartphone,
  Laptop,
  Tablet,
  Share2,
  Tag,
  Calendar,
  Layers,
  ArrowLeft,
  FileText,
  ExternalLink,
  Edit3,
  Link2,
  QrCode,
  MousePointerClick,
  Clock,
  User,
  Files,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isDubConfigured, getDubLinkInfo, getDubLinks } from "@/lib/dub";
import { DubPostAnalyticsCard } from "@/components/admin/analytics/DubPostAnalyticsCard";

/**
 * Normalizes raw HTTP Referrer strings into clean root domain names.
 *
 * @param {string | null} rawReferrer - Raw HTTP Referrer string from analytics payload.
 * @returns {string} Clean root domain name or fallback description.
 */
function cleanReferrerDomain(rawReferrer: string | null): string {
  if (!rawReferrer || !rawReferrer.trim()) return "Direct / Search";
  try {
    const url = new URL(rawReferrer.startsWith("http") ? rawReferrer : `https://${rawReferrer}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return rawReferrer.replace(/^https?:\/\//, "").split("/")[0] || "Direct";
  }
}

/**
 * Consolidated individual analytics dashboard querying and rendering granular metrics,
 * visitor logs, geographic breakdown, device statistics, UTM attribution, and Dub.co
 * shortlink performance for a specific article or static custom page.
 *
 * @param {Object} props - Route parameters.
 * @param {Promise<{ id: string; locale: string }>} props.params - Promise resolving to item ID and active locale code.
 * @returns {Promise<React.JSX.Element>} React JSX analytics dashboard element.
 * @throws {Error} Throws notFound if neither a matching post nor custom page exists for the given ID.
 */
export default async function IndividualAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const ta = await getTranslations({ locale, namespace: "admin" });

  const site = await getActiveSite();
  if (!site) notFound();

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
    .where(and(eq(posts.siteId, site.id), eq(posts.id, id)))
    .get();

  const page = !post
    ? db
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
        .where(and(eq(pages.siteId, site.id), eq(pages.id, id)))
        .get()
    : null;

  if (!post && !page) {
    notFound();
  }

  const isPost = Boolean(post);
  const item = (post || page)!;
  const canonicalPath = isPost ? `/entry/${item.slug}` : `/p/${item.slug}`;
  const editHref = isPost ? `/admin/posts/${item.id}` : `/admin/pages/${item.id}`;

  const itemCondition = and(
    eq(analytics.siteId, site.id),
    or(
      isPost ? eq(analytics.postId, item.id) : eq(analytics.pageId, item.id),
      eq(analytics.path, canonicalPath)
    )
  );

  const totalPageViews = db
    .select({ count: sql<number>`count(*)` })
    .from(analytics)
    .where(itemCondition)
    .get()?.count || 0;

  const uniqueVisitors = db
    .select({ count: sql<number>`count(distinct ip_hash)` })
    .from(analytics)
    .where(itemCondition)
    .get()?.count || 0;

  const rawReferrers = db
    .select({
      referrer: analytics.referrer,
    })
    .from(analytics)
    .where(itemCondition)
    .all();

  const referrerCounts: Record<string, number> = {};
  for (const row of rawReferrers) {
    const domain = cleanReferrerDomain(row.referrer);
    referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
  }
  const topReferrers = Object.entries(referrerCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const topCountries = db
    .select({
      country: analytics.country,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(itemCondition)
    .groupBy(analytics.country)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const deviceStats = db
    .select({
      device: analytics.device,
      count: sql<number>`count(*)`,
    })
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
    .select({
      source: analytics.utmSource,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(and(itemCondition, isNotNull(analytics.utmSource)))
    .groupBy(analytics.utmSource)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const utmCampaigns = db
    .select({
      campaign: analytics.utmCampaign,
      count: sql<number>`count(*)`,
    })
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
    .select({
      timestamp: analytics.createdAt,
    })
    .from(analytics)
    .where(and(itemCondition, gte(analytics.createdAt, fourteenDaysAgo)))
    .all();

  const dailyTimeline: Array<{ dateStr: string; label: string; count: number }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString(locale, { day: "numeric", month: "short" });
    dailyTimeline.push({ dateStr, label, count: 0 });
  }

  for (const hit of recentHits) {
    if (!hit.timestamp) continue;
    const hitDateStr = new Date(hit.timestamp).toISOString().split("T")[0];
    const itemDay = dailyTimeline.find((t) => t.dateStr === hitDateStr);
    if (itemDay) itemDay.count++;
  }

  const maxDailyViews = Math.max(1, ...dailyTimeline.map((d) => d.count));

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

  let dubInfo = null;
  const isDubActive = isDubConfigured();
  if (isDubActive && post) {
    if (post.dubLinkId) {
      dubInfo = await getDubLinkInfo(post.dubLinkId);
    }
    if (!dubInfo && post.shortUrl) {
      const allLinks = await getDubLinks();
      dubInfo = allLinks.find((l) => l.shortLink === post.shortUrl || l.key === post.slug) || null;
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-surface border border-border rounded-xl shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <Link
            href="/admin/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("title")}</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-text tracking-tight truncate max-w-xl">
              {item.title}
            </h1>
            <Badge variant={item.status === "published" ? "success" : "warning"}>
              {item.status === "published" ? ta("statusPublished") : ta("statusDraft")}
            </Badge>
            <span className="text-[10px] font-mono font-medium text-text-muted bg-surface-hover px-2 py-0.5 rounded border border-border">
              {isPost ? t("article") : t("staticPage")}
            </span>
          </div>
          <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
            {item.authorName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-text-muted" />
                {item.authorName}
              </span>
            )}
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              {item.publishedAt ? formatDate(item.publishedAt, locale) : formatDate(item.createdAt, locale)}
            </span>
            <span>•</span>
            <span className="font-mono uppercase text-[10px] text-text-muted">{item.locale}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.status === "published" && (
            <a
              href={canonicalPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <Button size="sm" variant="outline" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                {tc("view")}
              </Button>
            </a>
          )}
          <Link href={editHref}>
            <Button size="sm" variant="primary" icon={<Edit3 className="w-3.5 h-3.5" />}>
              {tc("edit")}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isDubActive && dubInfo ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-text-muted">{t("totalVisits")}</p>
            <p className="text-xl font-bold text-text tabular-nums mt-0.5">
              {Math.max(item.views, totalPageViews).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-text-muted">{t("uniqueVisitors")}</p>
            <p className="text-xl font-bold text-text tabular-nums mt-0.5">{uniqueVisitors.toLocaleString()}</p>
          </div>
        </div>

        {isDubActive && dubInfo && (
          <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted">{t("dubTotalClicks")}</p>
              <p className="text-xl font-bold text-text tabular-nums mt-0.5">{dubInfo.clicks.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-text-muted">{t("trafficSources")}</p>
            <p className="text-xl font-bold text-text tabular-nums mt-0.5">{topReferrers.length}</p>
          </div>
        </div>
      </div>

      {/* Dub.co Dedicated Article Card (if post) */}
      {isDubActive && post && (
        <DubPostAnalyticsCard
          postId={post.id}
          siteDomain={site.domain}
          slug={post.slug}
          title={post.title}
          locale={post.locale}
          existingShortUrl={post.shortUrl}
          dubInfo={dubInfo}
        />
      )}

      {/* 14-Day Timeline Chart */}
      <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text">{t("trafficEvolution")}</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {t("periodVisits", { count: recentHits.length })}
          </span>
        </div>

        <div className="pt-4 pb-2">
          <div className="grid grid-cols-14 gap-1.5 sm:gap-2 items-end h-36">
            {dailyTimeline.map((day, idx) => {
              const heightPct = Math.round((day.count / maxDailyViews) * 100);
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-mono text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.count}
                  </span>
                  <div className="w-full bg-surface-hover/80 rounded-t-md relative flex items-end h-full overflow-hidden">
                    <div
                      className="w-full bg-accent hover:bg-accent/80 transition-all rounded-t-md"
                      style={{ height: `${Math.max(day.count > 0 ? 8 : 2, heightPct)}%` }}
                      title={`${day.label}: ${day.count}`}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-text-muted truncate w-full text-center">
                    {day.label.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Traffic Sources & Device Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* UTM Attribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
                <Share2 className="w-3.5 h-3.5 text-accent" />
                <span>{t("utmSources")}</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {utmSources.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-text font-medium flex items-center gap-1.5 truncate max-w-[160px]">
                      <Tag className="w-3 h-3 text-accent" />
                      {s.source}
                    </span>
                    <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                      {s.count}
                    </span>
                  </div>
                ))}
                {utmSources.length === 0 && (
                  <p className="text-xs text-text-muted py-2">{t("noUtmSources")}</p>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t("utmCampaignsHeader")}</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {utmCampaigns.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-text font-medium truncate max-w-[160px]">{c.campaign}</span>
                    <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                      {c.count}
                    </span>
                  </div>
                ))}
                {utmCampaigns.length === 0 && (
                  <p className="text-xs text-text-muted py-2">{t("noUtmCampaigns")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Visitor Logs */}
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <span>{t("recentVisitsLog")}</span>
              </h3>
              <span className="text-xs font-mono text-text-muted">
                {recentLogs.length} logs
              </span>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-text font-medium">
                      <span className="capitalize">{log.device || "desktop"}</span>
                      <span>•</span>
                      <span>{log.browser || "Browser"}</span>
                      {log.country && (
                        <>
                          <span>•</span>
                          <span className="text-text-muted font-mono">{log.country}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {log.referrer ? cleanReferrerDomain(log.referrer) : "Direct"}
                      {log.utmSource ? ` (utm_source: ${log.utmSource})` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-text-muted shrink-0">
                    {log.createdAt ? formatDate(log.createdAt, locale) : ""}
                  </span>
                </div>
              ))}

              {recentLogs.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">{t("noTrafficYet")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Referrers, Devices, Geo */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-accent rotate-135" />
              <span>{t("referrers")}</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              {topReferrers.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text truncate max-w-[170px] font-medium">{r.domain}</span>
                  <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                    {r.count}
                  </span>
                </div>
              ))}
              {topReferrers.length === 0 && (
                <p className="text-xs text-text-muted py-1.5">{t("noReferrers")}</p>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-accent" />
              <span>{t("devicesAndBrowsers")}</span>
            </h3>

            <div className="space-y-2 text-xs">
              {deviceStats.map((d, i) => {
                const pct = Math.round((d.count / totalDevicesCount) * 100);
                const Icon = d.device === "mobile" ? Smartphone : d.device === "tablet" ? Tablet : Laptop;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-text">
                      <span className="capitalize flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-text-muted" />
                        {d.device === "mobile" ? t("mobile") : d.device === "tablet" ? t("tablet") : t("desktop")}
                      </span>
                      <span className="font-mono text-text-muted">{pct}% ({d.count})</span>
                    </div>
                    <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                      <div className="h-full bg-accent/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {deviceStats.length === 0 && (
                <p className="text-xs text-text-muted py-1">{t("noDevices")}</p>
              )}
            </div>

            {browserStats.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5 text-xs">
                <p className="text-[11px] font-semibold text-text-muted">{t("topBrowsers")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {browserStats.map((b, i) => {
                    const browserLabel = b.browser === "Other" || !b.browser ? t("otherBrowser") : b.browser;
                    return (
                      <span key={i} className="text-[11px] bg-surface-hover px-2 py-0.5 rounded border border-border text-text">
                        {browserLabel}: <span className="font-mono text-text-muted">{b.count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>{t("geoDistribution")}</span>
            </h3>
            <div className="space-y-2 text-xs">
              {topCountries.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text">{c.country || t("globalUnknown")}</span>
                  <span className="font-mono text-text-muted bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                    {c.count}
                  </span>
                </div>
              ))}
              {topCountries.length === 0 && (
                <p className="text-xs text-text-muted py-1.5">{t("noGeo")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
