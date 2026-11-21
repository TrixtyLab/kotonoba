import { getTranslations } from "next-intl/server";
import { getAdminSite } from "@/lib/tenant";
import { getItemAnalyticsReport } from "@/lib/queries/analytics";
import { POST_STATUS } from "@/lib/config/constants";
import { notFound } from "next/navigation";
import {
  TrendingUp,
  Eye,
  Compass,
  Calendar,
  ArrowLeft,
  ExternalLink,
  Edit3,
  MousePointerClick,
  Clock,
  User,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DubPostAnalyticsCard } from "@/components/admin/analytics/DubPostAnalyticsCard";
import { ItemBreakdownSection } from "@/components/admin/analytics/ItemBreakdownSection";

/**
 * Consolidated individual analytics dashboard for a specific article or static custom page.
 */
export default async function IndividualAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const [t, tc] = await Promise.all([
    getTranslations({ locale, namespace: "analytics" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  const site = await getAdminSite();
  if (!site) notFound();

  const report = await getItemAnalyticsReport(site.id, id, locale);
  if (!report) notFound();

  const {
    isPost,
    item,
    canonicalPath,
    editHref,
    totalPageViews,
    uniqueVisitors,
    topReferrers,
    recentHitsCount,
    dailyTimeline,
    maxDailyViews,
    isDubActive,
    dubInfo,
  } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-surface border border-border rounded-xl shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <Link href="/admin/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("title")}</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-text tracking-tight truncate max-w-xl">{item.title}</h1>
            <StatusBadge status={item.status} />
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
          {item.status === POST_STATUS.PUBLISHED && (
            <a href={canonicalPath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
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

      {isDubActive && isPost && (
        <DubPostAnalyticsCard
          postId={item.id}
          siteDomain={site.domain}
          slug={item.slug}
          title={item.title}
          locale={item.locale}
          existingShortUrl={item.shortUrl ?? null}
          dubInfo={dubInfo}
        />
      )}

      <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text">{t("trafficEvolution")}</h2>
          </div>
          <span className="text-xs font-mono text-text-muted">{t("periodVisits", { count: recentHitsCount })}</span>
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

      <ItemBreakdownSection report={report} locale={locale} />
    </div>
  );
}
