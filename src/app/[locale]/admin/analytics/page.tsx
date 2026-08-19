import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
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
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { ResetAnalyticsButton } from "@/components/admin/analytics/ResetAnalyticsButton";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Normalizes referrer strings into clean root domains.
 *
 * @param rawReferrer - Raw HTTP Referrer string from analytics payload.
 * @returns Clean root domain name or fallback description.
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
 * Administrative analytics dashboard querying and visualizing metrics including total views, unique visitors, UTM campaigns, device distributions, and timeline charts.
 *
 * @returns React JSX analytics dashboard view.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-text flex items-center gap-2 pb-3 border-b border-border">
              <BarChart3 className="w-4 h-4 text-accent" />
              <span>{t("mostViewedArticles")}</span>
            </h2>

            <div className="space-y-3.5 pt-1">
              {topPosts.map((p) => {
                const pct = Math.round((p.views / maxPostViews) * 100);

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Link
                        href={`/admin/posts/${p.id}`}
                        className="font-medium text-text hover:text-accent transition-colors truncate max-w-sm flex items-center gap-1.5"
                      >
                        <span>{p.title}</span>
                        {p.shortUrl && (
                          <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.2 rounded shrink-0">
                            Dub
                          </span>
                        )}
                      </Link>
                      <span className="font-mono text-text-muted shrink-0 ml-2">{p.views.toLocaleString()}</span>
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
