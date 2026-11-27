import { getTranslations } from "next-intl/server";
import { getAdminSite } from "@/lib/tenant";
import { getSiteRetentionSummary } from "@/lib/analytics/retention";
import { notFound } from "next/navigation";
import { RotateCcw, Users, UserCheck, UserPlus, Layers } from "lucide-react";
import { MetricCard } from "@/components/admin/analytics/MetricCard";
import { BarChart, BarChartItem } from "@/components/admin/analytics/BarChart";
import { DataTable, type ColumnDef } from "@/components/admin/analytics/DataTable";

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

function getHeatmapColor(pct: number): string {
  if (pct === 0) return "bg-surface-hover/30 text-text-muted";
  if (pct < 20) return "bg-emerald-500/10 text-emerald-500";
  if (pct < 50) return "bg-emerald-500/20 text-emerald-600 font-bold";
  if (pct < 80) return "bg-emerald-500/30 text-emerald-700 font-bold";
  return "bg-emerald-500/40 text-emerald-800 font-bold";
}

function renderWeekCell(size: number, pct: number): React.JSX.Element {
  return (
    <span className={`inline-block w-full py-1 px-2 rounded font-mono tabular-nums ${getHeatmapColor(pct)}`}>
      {size > 0 ? `${pct}%` : "-"}
    </span>
  );
}

/**
 * Visitor retention and cohort stickiness view assessing repeat audience frequency and multi-week re-engagement.
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

  const cohortColumns: ColumnDef<CohortRow>[] = [
    {
      key: "cohortLabel",
      header: t("cohort"),
      render: (row) => <span className="font-semibold text-text">{row.cohortLabel}</span>,
    },
    {
      key: "size",
      header: t("visitors"),
      align: "right",
      render: (row) => <span className="font-mono tabular-nums font-bold text-text">{row.size}</span>,
    },
    { key: "w0", header: t("week0"), align: "center", render: (row) => renderWeekCell(row.size, row.w0) },
    { key: "w1", header: t("week1"), align: "center", render: (row) => renderWeekCell(row.size, row.w1) },
    { key: "w2", header: t("week2"), align: "center", render: (row) => renderWeekCell(row.size, row.w2) },
    { key: "w3", header: t("week3"), align: "center", render: (row) => renderWeekCell(row.size, row.w3) },
  ];

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
        <MetricCard title={t("newVisitors")} value={newVisitors} icon={UserPlus} color="blue" />
        <MetricCard title={t("returningVisitors")} value={returningVisitors} icon={UserCheck} color="teal" />
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
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Layers className="w-4 h-4 text-violet-500" />
          <h3 className="text-xs font-bold text-text">{t("cohortWeekly")}</h3>
        </div>

        <DataTable
          columns={cohortColumns}
          data={cohorts}
          rowKey={(row) => row.cohortLabel}
          emptyMessage={t("noTrafficYet")}
        />
      </div>
    </div>
  );
}
