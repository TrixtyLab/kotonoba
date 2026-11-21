import { getTranslations } from "next-intl/server";
import { getAdminSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Zap, Gauge, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getDateRangeBounds } from "@/lib/analytics/query";
import { getAnalyticsPerformanceData } from "@/lib/queries/analytics-traffic";
import { MetricCard } from "@/components/admin/analytics/MetricCard";
import { BarChart, BarChartItem } from "@/components/admin/analytics/BarChart";
import { DataTable, ColumnDef } from "@/components/admin/analytics/DataTable";

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

interface SlowPageRow {
  path: string;
  avgLoadTime: number;
  samples: number;
}

/**
 * Site performance view calculating load latencies, percentiles (P50/P75/P95), and slowest individual page routes.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered performance analytics view.
 */
export default async function AnalyticsPerformancePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getAdminSite();
  if (!site) notFound();

  const bounds = getDateRangeBounds(sp.range);
  const { sampleCount, p50, p75, p95, avg, fastCount, moderateCount, slowCount, slowestHits } =
    getAnalyticsPerformanceData(site.id, bounds, sp);

  const bucketItems: BarChartItem[] = [
    {
      label: t("fastLoads"),
      value: fastCount,
      percentage: sampleCount > 0 ? Math.round((fastCount / sampleCount) * 100) : 0,
      color: "#10b981",
    },
    {
      label: t("moderateLoads"),
      value: moderateCount,
      percentage: sampleCount > 0 ? Math.round((moderateCount / sampleCount) * 100) : 0,
      color: "#f59e0b",
    },
    {
      label: t("slowLoads"),
      value: slowCount,
      percentage: sampleCount > 0 ? Math.round((slowCount / sampleCount) * 100) : 0,
      color: "#ef4444",
    },
  ];

  const slowColumns: ColumnDef<SlowPageRow>[] = [
    {
      key: "path",
      header: t("paths"),
      render: (row) => <span className="font-mono font-semibold text-text truncate max-w-sm block">{row.path}</span>,
    },
    {
      key: "avgLoadTime",
      header: t("avgLoadTime"),
      align: "right",
      render: (row) => (
        <span
          className={`font-mono font-bold tabular-nums ${
            row.avgLoadTime < 1000
              ? "text-emerald-500"
              : row.avgLoadTime <= 3000
              ? "text-amber-500"
              : "text-rose-500"
          }`}
        >
          {row.avgLoadTime}ms
        </span>
      ),
    },
    {
      key: "samples",
      header: t("samples"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.samples}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Latency KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title={t("avgLoadTime")}
          value={avg > 0 ? `${avg}ms` : "-"}
          icon={Clock}
          color="blue"
        />
        <MetricCard
          title={t("p50Median")}
          value={p50 > 0 ? `${p50}ms` : "-"}
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title={t("p75WebVitals")}
          value={p75 > 0 ? `${p75}ms` : "-"}
          subtitle={t("p75Subtitle")}
          icon={Gauge}
          color="amber"
        />
        <MetricCard
          title={t("p95Tail")}
          value={p95 > 0 ? `${p95}ms` : "-"}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Latency Distribution & Slowest Pages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency Distribution */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-text">{t("loadTimePercentiles")}</h3>
          </div>
          <BarChart items={bucketItems} orientation="horizontal" emptyMessage={t("noTrafficYet")} />
        </div>

        {/* Slowest Pages Table */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-text">{t("slowestPages")}</h3>
          </div>
          <DataTable
            columns={slowColumns}
            data={slowestHits}
            emptyMessage={t("noTrafficYet")}
            rowKey={(r) => r.path}
          />
        </div>
      </div>
    </div>
  );
}
