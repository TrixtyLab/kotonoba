import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc } from "drizzle-orm";
import {
  Eye,
  Users,
  Activity,
  Clock,
  Zap,
  ArrowUpRight,
  FileText,
  Compass,
  Globe,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getAnalyticsOverviewMetrics,
  cleanReferrerDomain,
  buildAnalyticsFilterConditions,
} from "@/lib/analytics/query";
import { MetricCard } from "@/components/admin/analytics/MetricCard";
import { BarChart } from "@/components/admin/analytics/BarChart";
import { CountryFlag, getCountryName } from "@/components/ui/CountryFlag";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    range?: string;
    country?: string;
    browser?: string;
    device?: string;
    os?: string;
  }>;
}

/**
 * High-level overview dashboard showcasing primary engagement KPIs, chronological traffic trends, and quick top performers.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered overview page view.
 */
export default async function AdminAnalyticsOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getActiveSite();
  if (!site) notFound();

  const metrics = await getAnalyticsOverviewMetrics(site.id, sp.range, sp);
  const db = getDb();
  const filterCondition = buildAnalyticsFilterConditions(
    site.id,
    metrics.bounds.start,
    metrics.bounds.end,
    sp
  );

  // Top 5 paths
  const topPaths = db
    .select({
      path: analytics.path,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  // Top 5 referrers
  const rawReferrers = db
    .select({
      referrer: analytics.referrer,
      count: sql<number>`count(*)`,
    })
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

  // Top 5 countries
  const topCountries = db
    .select({
      country: analytics.country,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.country)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  // Daily timeline (last 14 or 30 days based on range)
  const timelineDays = Math.min(Math.max(metrics.bounds.days, 7), 30);
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
    if (row.dayString) {
      dailyCountMap.set(row.dayString, row.count);
    }
  }

  const timelineItems = [];
  const now = new Date();
  for (let i = timelineDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
    timelineItems.push({
      label,
      value: dailyCountMap.get(key) || 0,
    });
  }

  const formatDuration = (sec: number): string => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* 5 Core KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title={t("views")}
          value={metrics.totalViews}
          icon={Eye}
          color="blue"
          trend={metrics.viewsGrowth !== 0 ? { value: metrics.viewsGrowth } : undefined}
        />
        <MetricCard
          title={t("visitors")}
          value={metrics.uniqueVisitors}
          icon={Users}
          color="emerald"
          trend={metrics.visitorsGrowth !== 0 ? { value: metrics.visitorsGrowth } : undefined}
        />
        <MetricCard
          title={t("bounceRate")}
          value={`${metrics.bounceRate}%`}
          subtitle={t("bounceSubtitle")}
          icon={Activity}
          color="amber"
        />
        <MetricCard
          title={t("avgDuration")}
          value={formatDuration(metrics.avgDurationSeconds)}
          icon={Clock}
          color="violet"
        />
        <MetricCard
          title={t("avgLoadTime")}
          value={metrics.avgLoadTime > 0 ? `${metrics.avgLoadTime}ms` : "-"}
          icon={Zap}
          color="teal"
        />
      </div>

      {/* Traffic Timeline */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text">{t("trafficEvolution")}</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {t("periodVisits", { count: metrics.totalViews })}
          </span>
        </div>

        <BarChart
          items={timelineItems}
          orientation="vertical"
          height={140}
          emptyMessage={t("noTrafficYet")}
        />
      </div>

      {/* Quick Top 5 Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Content */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-text">{t("topPagesHeader")}</h3>
              </div>
              <Link
                href="/admin/analytics/pages"
                className="text-[11px] text-accent hover:underline flex items-center gap-0.5"
              >
                <span>{t("viewAll")}</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/60 pt-1">
              {topPaths.length > 0 ? (
                topPaths.map((p) => (
                  <div key={p.path} className="py-2 flex items-center justify-between text-xs gap-2">
                    <span className="font-mono text-text truncate max-w-[70%]" title={p.path}>
                      {p.path}
                    </span>
                    <span className="font-mono font-bold text-text tabular-nums shrink-0">
                      {p.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-text-muted italic">{t("noPathsYet")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold text-text">{t("topSourcesHeader")}</h3>
              </div>
              <Link
                href="/admin/analytics/sources"
                className="text-[11px] text-accent hover:underline flex items-center gap-0.5"
              >
                <span>{t("viewAll")}</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/60 pt-1">
              {topReferrers.length > 0 ? (
                topReferrers.map((r) => (
                  <div key={r.domain} className="py-2 flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-text truncate max-w-[70%]" title={r.domain}>
                      {r.domain}
                    </span>
                    <span className="font-mono font-bold text-text tabular-nums shrink-0">
                      {r.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-text-muted italic">{t("noReferrers")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-text">{t("topCountriesHeader")}</h3>
              </div>
              <Link
                href="/admin/analytics/visitors"
                className="text-[11px] text-accent hover:underline flex items-center gap-0.5"
              >
                <span>{t("viewAll")}</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/60 pt-1">
              {topCountries.length > 0 ? (
                topCountries.map((c) => {
                  const isKnown = Boolean(c.country && c.country !== t("globalUnknown"));
                  const countryName = isKnown ? getCountryName(c.country, locale) : (c.country || t("globalUnknown"));

                  return (
                    <div key={c.country || "unknown"} className="py-2 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0 max-w-[75%]">
                        <CountryFlag code={c.country} locale={locale} />
                        <span className="font-medium text-text truncate">
                          {countryName}
                        </span>
                        {isKnown && (
                          <span className="font-mono text-[10px] text-text-muted shrink-0">
                            {c.country}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-text tabular-nums shrink-0">
                        {c.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="py-4 text-center text-xs text-text-muted italic">{t("noGeo")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
