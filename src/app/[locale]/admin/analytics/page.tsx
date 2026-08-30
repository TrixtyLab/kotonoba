import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics, posts, pages } from "@/lib/db/schema";
import { eq, desc, sql, and, isNotNull, gte } from "drizzle-orm";
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
  ArrowUpRight,
  Files,
  FileText,
  ExternalLink,
  Plus,
  Link2,
  MousePointerClick,
  QrCode,
  Edit3,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { ResetAnalyticsButton } from "@/components/admin/analytics/ResetAnalyticsButton";
import { getLocalizedText } from "@/lib/utils/localization";
import { getDubAnalyticsSummary } from "@/lib/dub";

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
 * Administrative analytics dashboard querying and visualizing metrics including total views, unique visitors, UTM campaigns, top articles, top custom pages, top visited paths, device distributions, and timeline charts.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving to route parameters with active locale.
 * @returns {Promise<React.JSX.Element>} React JSX analytics dashboard view.
 */
export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();

  const totalPageViews = db
    .select({ count: sql<number>`count(*)` })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .get()?.count || 0;

  const uniqueVisitors = db
    .select({ count: sql<number>`count(distinct ip_hash)` })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .get()?.count || 0;

  const topPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      views: posts.views,
      shortUrl: posts.shortUrl,
    })
    .from(posts)
    .where(eq(posts.siteId, site.id))
    .orderBy(desc(posts.views))
    .limit(8)
    .all();

  const topPages = db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      views: pages.views,
    })
    .from(pages)
    .where(eq(pages.siteId, site.id))
    .orderBy(desc(pages.views))
    .limit(8)
    .all();

  const topPaths = db
    .select({
      path: analytics.path,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();

  const rawReferrers = db
    .select({
      referrer: analytics.referrer,
    })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
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
    .where(eq(analytics.siteId, site.id))
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
    .where(eq(analytics.siteId, site.id))
    .groupBy(analytics.device)
    .all();

  const totalDevicesCount = deviceStats.reduce((acc, d) => acc + d.count, 0) || 1;

  const browserStats = db
    .select({
      browser: sql<string>`case when ${analytics.browser} is null or ${analytics.browser} = '' then 'Other' else ${analytics.browser} end`,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
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
    .where(and(eq(analytics.siteId, site.id), isNotNull(analytics.utmSource)))
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
    .where(and(eq(analytics.siteId, site.id), isNotNull(analytics.utmCampaign)))
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
    .where(and(eq(analytics.siteId, site.id), gte(analytics.createdAt, fourteenDaysAgo)))
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
    const item = dailyTimeline.find((t) => t.dateStr === hitDateStr);
    if (item) item.count++;
  }

  const maxDailyViews = Math.max(1, ...dailyTimeline.map((d) => d.count));
  const maxPostViews = Math.max(1, ...topPosts.map((p) => p.views));
  const maxPageViews = Math.max(1, ...topPages.map((p) => p.views));
  const maxPathViews = Math.max(1, ...topPaths.map((p) => p.count));

  const dubSummary = await getDubAnalyticsSummary();
  const maxDubClicks = Math.max(1, ...dubSummary.links.map((l) => l.clicks));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <span>{t("title")}</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("subtitle", { site: getLocalizedText(site.name, locale) })}
          </p>
        </div>

        <ResetAnalyticsButton siteId={site.id} />
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${dubSummary.isConfigured ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-text-muted">{t("totalVisits")}</p>
            <p className="text-xl font-bold text-text tabular-nums mt-0.5">{totalPageViews.toLocaleString()}</p>
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

        {dubSummary.isConfigured && (
          <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted">{t("dubTotalClicks")}</p>
              <p className="text-xl font-bold text-text tabular-nums mt-0.5">{dubSummary.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-text-muted">{t("utmCampaigns")}</p>
            <p className="text-xl font-bold text-text tabular-nums mt-0.5">{utmCampaigns.length}</p>
          </div>
        </div>

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

      {/* Dub.co Analytics Section */}
      {dubSummary.isConfigured && (
        <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text flex items-center gap-2">
                  <span>{t("dubAnalytics")}</span>
                  <span className="text-[10px] font-mono font-normal bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {dubSummary.domain}
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">{t("dubSubtitle")}</p>
              </div>
            </div>
            <a
              href="https://app.dub.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 self-start sm:self-center"
            >
              <span>{t("dubViewInDub")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-lg bg-surface-hover/40 border border-border/70">
              <p className="text-[11px] font-medium text-text-muted">{t("dubTotalClicks")}</p>
              <p className="text-lg font-bold text-text tabular-nums mt-0.5">{dubSummary.totalClicks.toLocaleString()}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-surface-hover/40 border border-border/70">
              <p className="text-[11px] font-medium text-text-muted">{t("dubTrackedLinks")}</p>
              <p className="text-lg font-bold text-text tabular-nums mt-0.5">{dubSummary.totalLinks.toLocaleString()}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-surface-hover/40 border border-border/70">
              <p className="text-[11px] font-medium text-text-muted">{t("dubTopLink")}</p>
              <p className="text-sm font-semibold text-accent truncate mt-1">
                {dubSummary.topLink ? (
                  <a href={dubSummary.topLink.shortLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {dubSummary.topLink.shortLink.replace(/^https?:\/\//, "")} ({dubSummary.topLink.clicks} {t("dubClicks")})
                  </a>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {dubSummary.links.map((link) => {
              const pct = Math.round((link.clicks / maxDubClicks) * 100);
              return (
                <div key={link.id} className="space-y-1.5 p-3 rounded-lg bg-surface-hover/30 border border-border/60 hover:border-border transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={link.shortLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-semibold text-accent hover:underline flex items-center gap-1"
                        >
                          <span>{link.shortLink}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {link.qrCode && (
                          <a
                            href={link.qrCode}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-text-muted hover:text-text flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded border border-border/60"
                            title={t("dubQrCode")}
                          >
                            <QrCode className="w-3 h-3" />
                            <span>{t("dubQrCode")}</span>
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted truncate">
                        <span className="font-medium text-text-muted/80">{t("dubTarget")}: </span>
                        {link.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="font-mono text-xs font-semibold text-text bg-surface-hover px-2.5 py-1 rounded-md border border-border/60">
                        {link.clicks.toLocaleString()} {t("dubClicks")}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(link.clicks > 0 ? 5 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {dubSummary.links.length === 0 && (
              <p className="text-xs text-text-muted py-6 text-center">{t("dubNoLinksYet")}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Most Viewed Articles */}
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <span>{t("mostViewedArticles")}</span>
              </h2>
              <Link href="/admin/posts" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
                {tc("viewAll")} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5 pt-1">
              {topPosts.map((p) => {
                const pct = Math.round((p.views / maxPostViews) * 100);

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-sm">
                        <Link
                          href={`/admin/analytics/${p.id}`}
                          className="font-medium text-text hover:text-accent transition-colors truncate flex items-center gap-1.5"
                          title={t("viewDetailedAnalytics")}
                        >
                          <span>{p.title}</span>
                        </Link>
                        {p.shortUrl && (
                          <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.2 rounded shrink-0">
                            Dub
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Link
                          href={`/admin/analytics/${p.id}`}
                          className="font-mono text-text-muted hover:text-accent font-semibold transition-colors"
                          title={t("viewDetailedAnalytics")}
                        >
                          {p.views.toLocaleString()}
                        </Link>
                        <Link
                          href={`/admin/posts/${p.id}`}
                          className="text-text-muted hover:text-accent p-0.5 rounded transition-colors"
                          title={tc("edit")}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {topPosts.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">{t("noTrafficYet")}</p>
              )}
            </div>
          </div>

          {/* Most Viewed Static Pages */}
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text flex items-center gap-2">
                <Files className="w-4 h-4 text-emerald-500" />
                <span>{t("mostViewedPages")}</span>
              </h2>
              <Link href="/admin/pages" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
                {tc("viewAll")} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5 pt-1">
              {topPages.map((p) => {
                const pct = Math.round((p.views / maxPageViews) * 100);

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 max-w-sm">
                        <Link
                          href={`/admin/analytics/${p.id}`}
                          className="font-medium text-text hover:text-accent transition-colors truncate"
                          title={t("viewDetailedAnalytics")}
                        >
                          <span>{p.title}</span>
                        </Link>
                        <a
                          href={`/p/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-text shrink-0"
                          title={tc("preview")}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Link
                          href={`/admin/analytics/${p.id}`}
                          className="font-mono text-text-muted hover:text-accent font-semibold transition-colors"
                          title={t("viewDetailedAnalytics")}
                        >
                          {p.views.toLocaleString()}
                        </Link>
                        <Link
                          href={`/admin/pages/${p.id}`}
                          className="text-text-muted hover:text-accent p-0.5 rounded transition-colors"
                          title={tc("edit")}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {topPages.length === 0 && (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-text-muted">{t("noPagesTrafficYet")}</p>
                  <Link href="/admin/pages/new">
                    <button className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tc("create")}</span>
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Top Visited URLs & Paths */}
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-bold text-text flex items-center gap-2">
                <Compass className="w-4 h-4 text-violet-500" />
                <span>{t("topPaths")}</span>
              </h2>
              <span className="text-xs font-mono text-text-muted">
                {topPaths.length} {t("paths").toLowerCase()}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {topPaths.map((tp, idx) => {
                const pct = Math.round((tp.count / maxPathViews) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-text text-[11px] truncate max-w-sm">
                        {tp.path}
                      </span>
                      <span className="font-mono text-text-muted shrink-0 ml-2 bg-surface-hover px-2 py-0.5 rounded text-[11px]">
                        {tp.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500/80 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {topPaths.length === 0 && (
                <p className="text-xs text-text-muted py-6 text-center">{t("noPathsYet")}</p>
              )}
            </div>
          </div>

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
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
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

