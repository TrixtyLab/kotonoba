import { getTranslations } from "next-intl/server";
import { getAdminSite } from "@/lib/tenant";
import { getSiteRetentionSummary } from "@/lib/analytics/retention";
import { notFound } from "next/navigation";
import { RotateCcw, Users, UserCheck, UserPlus, Layers } from "lucide-react";
import { MetricCard } from "@/components/admin/analytics/MetricCard";
import { BarChart, BarChartItem } from "@/components/admin/analytics/BarChart";

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface CohortRow {
  cohortLabel: string;
  size: number;
  w0: number;
  w1: number;
  w2: number;
  w3: number;
}

/**
 * Visitor retention and cohort stickiness view assessing repeat audience frequency and multi-week re-engagement.
 *
 * @param {PageProps} props - Route parameters with active locale code.
 * @returns {Promise<React.JSX.Element>} Rendered retention and cohort matrix dashboard.
 */
export default async function AnalyticsRetentionPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getAdminSite();
  if (!site) notFound();

  const summary = getSiteRetentionSummary(site.id);
  const { totalVisitors, returningVisitors, newVisitors, retentionRate } = summary;

  const ratioItems: BarChartItem[] = [
    {
      label: t("newVisitors"),
      value: newVisitors,
      percentage: totalVisitors > 0 ? Math.round((newVisitors / totalVisitors) * 100) : 0,
      color: "#3b82f6",
    },
    {
      label: t("returningVisitors"),
      value: returningVisitors,
      percentage: totalVisitors > 0 ? Math.round((returningVisitors / totalVisitors) * 100) : 0,
      color: "#10b981",
    },
  ];

  const cohorts: CohortRow[] = summary.cohorts.map((row) => ({
    cohortLabel:
      row.cohortIndex === 0 ? t("currentWeek") : t("weeksAgo", { count: row.cohortIndex }),
    size: row.size,
    w0: row.w0,
    w1: row.w1,
    w2: row.w2,
    w3: row.w3,
  }));

  const getHeatmapColor = (pct: number): string => {
    if (pct === 0) return "bg-surface-hover/30 text-text-muted";
    if (pct < 20) return "bg-emerald-500/10 text-emerald-500";
    if (pct < 50) return "bg-emerald-500/20 text-emerald-600 font-bold";
    if (pct < 80) return "bg-emerald-500/30 text-emerald-700 font-bold";
    return "bg-emerald-500/40 text-emerald-800 font-bold";
  };

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          title={t("retentionRate")}
          value={`${retentionRate}%`}
          subtitle={t("audienceReturningRatio", { returning: returningVisitors, total: totalVisitors })}
          icon={RotateCcw}
          color="emerald"
        />
        <MetricCard
          title={t("newVisitors")}
          value={newVisitors}
          icon={UserPlus}
          color="blue"
        />
        <MetricCard
          title={t("returningVisitors")}
          value={returningVisitors}
          icon={UserCheck}
          color="teal"
        />
      </div>

      {/* Audience Split Ratio */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold text-text">{t("newVsReturning")}</h3>
        </div>
        <BarChart items={ratioItems} orientation="horizontal" emptyMessage={t("noTrafficYet")} />
      </div>

      {/* Weekly Retention Cohorts Matrix */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Layers className="w-4 h-4 text-violet-500" />
          <h3 className="text-xs font-bold text-text">{t("cohortWeekly")}</h3>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-hover/50 text-text-muted border-b border-border text-[11px] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">{t("cohort")}</th>
                <th className="py-2.5 px-4 text-right">{t("visitors")}</th>
                <th className="py-2.5 px-4 text-center">{t("week0")}</th>
                <th className="py-2.5 px-4 text-center">{t("week1")}</th>
                <th className="py-2.5 px-4 text-center">{t("week2")}</th>
                <th className="py-2.5 px-4 text-center">{t("week3")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {cohorts.map((row) => (
                <tr key={row.cohortLabel} className="hover:bg-surface-hover/40 transition-colors">
                  <td className="py-2.5 px-4 font-sans font-semibold text-text">{row.cohortLabel}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-bold text-text">{row.size}</td>
                  <td className={`py-2.5 px-4 text-center tabular-nums ${getHeatmapColor(row.w0)}`}>
                    {row.size > 0 ? `${row.w0}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-4 text-center tabular-nums ${getHeatmapColor(row.w1)}`}>
                    {row.size > 0 ? `${row.w1}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-4 text-center tabular-nums ${getHeatmapColor(row.w2)}`}>
                    {row.size > 0 ? `${row.w2}%` : "-"}
                  </td>
                  <td className={`py-2.5 px-4 text-center tabular-nums ${getHeatmapColor(row.w3)}`}>
                    {row.size > 0 ? `${row.w3}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
