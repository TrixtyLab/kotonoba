import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc } from "drizzle-orm";
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  getDateRangeBounds,
  buildAnalyticsFilterConditions,
} from "@/lib/analytics/query";
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

interface ComparisonMetricRow {
  metric: string;
  periodA: string | number;
  periodB: string | number;
  change: number;
}

interface PathComparisonRow {
  path: string;
  viewsA: number;
  viewsB: number;
  change: number;
}

/**
 * Period comparison view correlating engagement volumes, bounce shifts, dwell times, and content trajectory across consecutive time intervals.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered comparison dashboard.
 */
export default async function AnalyticsComparePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getActiveSite();
  if (!site) notFound();

  const bounds = getDateRangeBounds(sp.range);
  const conditionA = buildAnalyticsFilterConditions(site.id, bounds.start, bounds.end, sp);
  const conditionB = buildAnalyticsFilterConditions(site.id, bounds.previousStart, bounds.previousEnd, sp);
  const db = getDb();

  // Metric A
  const hitsA = db.select({ count: sql<number>`count(*)` }).from(analytics).where(conditionA).get()?.count || 0;
  const visitorsA = db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(conditionA).get()?.count || 0;

  // Metric B
  const hitsB = db.select({ count: sql<number>`count(*)` }).from(analytics).where(conditionB).get()?.count || 0;
  const visitorsB = db.select({ count: sql<number>`count(distinct ip_hash)` }).from(analytics).where(conditionB).get()?.count || 0;

  // Sessions A
  const sessionsA = db
    .select({
      pageviews: sql<number>`count(*)`,
      maxDuration: sql<number>`coalesce(max(time_on_page), 0)`,
    })
    .from(analytics)
    .where(conditionA)
    .groupBy(sql`coalesce(nullif(session_id, ''), ip_hash)`)
    .all();

  const totalSessionsA = sessionsA.length;
  const bouncedA = sessionsA.filter((s) => s.pageviews === 1 || s.maxDuration < 10).length;
  const bounceRateA = totalSessionsA > 0 ? Math.round((bouncedA / totalSessionsA) * 100) : 0;
  const avgDurationA = totalSessionsA > 0 ? Math.round(sessionsA.reduce((acc, s) => acc + s.maxDuration, 0) / totalSessionsA) : 0;

  // Sessions B
  const sessionsB = db
    .select({
      pageviews: sql<number>`count(*)`,
      maxDuration: sql<number>`coalesce(max(time_on_page), 0)`,
    })
    .from(analytics)
    .where(conditionB)
    .groupBy(sql`coalesce(nullif(session_id, ''), ip_hash)`)
    .all();

  const totalSessionsB = sessionsB.length;
  const bouncedB = sessionsB.filter((s) => s.pageviews === 1 || s.maxDuration < 10).length;
  const bounceRateB = totalSessionsB > 0 ? Math.round((bouncedB / totalSessionsB) * 100) : 0;
  const avgDurationB = totalSessionsB > 0 ? Math.round(sessionsB.reduce((acc, s) => acc + s.maxDuration, 0) / totalSessionsB) : 0;

  const calcChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const metricRows: ComparisonMetricRow[] = [
    {
      metric: t("views"),
      periodA: hitsA.toLocaleString(),
      periodB: hitsB.toLocaleString(),
      change: calcChange(hitsA, hitsB),
    },
    {
      metric: t("visitors"),
      periodA: visitorsA.toLocaleString(),
      periodB: visitorsB.toLocaleString(),
      change: calcChange(visitorsA, visitorsB),
    },
    {
      metric: t("bounceRate"),
      periodA: `${bounceRateA}%`,
      periodB: `${bounceRateB}%`,
      change: bounceRateA - bounceRateB,
    },
    {
      metric: t("avgDuration"),
      periodA: `${avgDurationA}s`,
      periodB: `${avgDurationB}s`,
      change: calcChange(avgDurationA, avgDurationB),
    },
  ];

  // Paths Comparison
  const pathsA = db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(conditionA)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all();

  const pathsBMap = new Map<string, number>();
  const pathsB = db
    .select({ path: analytics.path, count: sql<number>`count(*)` })
    .from(analytics)
    .where(conditionB)
    .groupBy(analytics.path)
    .all();

  for (const p of pathsB) {
    pathsBMap.set(p.path, p.count);
  }

  const pathComparisonRows: PathComparisonRow[] = pathsA.map((p) => {
    const viewsB = pathsBMap.get(p.path) || 0;
    return {
      path: p.path,
      viewsA: p.count,
      viewsB,
      change: calcChange(p.count, viewsB),
    };
  });

  const metricColumns: ColumnDef<ComparisonMetricRow>[] = [
    {
      key: "metric",
      header: t("metric"),
      render: (row) => <span className="font-bold text-text">{row.metric}</span>,
    },
    {
      key: "periodA",
      header: t("periodA"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-accent tabular-nums">{row.periodA}</span>,
    },
    {
      key: "periodB",
      header: t("periodB"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.periodB}</span>,
    },
    {
      key: "change",
      header: t("change"),
      align: "right",
      render: (row) => {
        const isNeutral = row.change === 0;
        const isPositive = row.change > 0;
        return (
          <span
            className={`inline-flex items-center gap-1 font-mono font-bold text-xs tabular-nums ${
              isNeutral ? "text-text-muted" : isPositive ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : isNeutral ? (
              <Minus className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{row.change > 0 ? `+${row.change}%` : `${row.change}%`}</span>
          </span>
        );
      },
    },
  ];

  const pathColumns: ColumnDef<PathComparisonRow>[] = [
    {
      key: "path",
      header: t("paths"),
      render: (row) => <span className="font-mono font-semibold text-text truncate max-w-sm block">{row.path}</span>,
    },
    {
      key: "viewsA",
      header: t("periodA"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-accent tabular-nums">{row.viewsA.toLocaleString()}</span>,
    },
    {
      key: "viewsB",
      header: t("periodB"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.viewsB.toLocaleString()}</span>,
    },
    {
      key: "change",
      header: t("change"),
      align: "right",
      render: (row) => {
        const isNeutral = row.change === 0;
        const isPositive = row.change > 0;
        return (
          <span
            className={`font-mono font-bold text-xs tabular-nums ${
              isNeutral ? "text-text-muted" : isPositive ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {row.change > 0 ? `+${row.change}%` : `${row.change}%`}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* High-Level Comparison Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold text-text">{t("comparePeriods")}</h2>
        </div>
        <DataTable
          columns={metricColumns}
          data={metricRows}
          emptyMessage={t("noTrafficYet")}
          rowKey={(r) => r.metric}
        />
      </div>

      {/* Content Shift Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-violet-500" />
          <h3 className="text-xs font-bold text-text">{t("contentShift")}</h3>
        </div>
        <DataTable
          columns={pathColumns}
          data={pathComparisonRows}
          emptyMessage={t("noTrafficYet")}
          rowKey={(r) => r.path}
        />
      </div>
    </div>
  );
}
