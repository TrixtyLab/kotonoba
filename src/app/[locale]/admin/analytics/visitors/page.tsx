import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc } from "drizzle-orm";
import {
  Laptop,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Languages,
  Maximize2,
} from "lucide-react";
import {
  getDateRangeBounds,
  buildAnalyticsFilterConditions,
} from "@/lib/analytics/query";
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

interface GeoRow {
  country: string;
  city: string;
  views: number;
}

interface ScreenRow {
  resolution: string;
  views: number;
}

/**
 * Visitor demographics view compiling device categories, client operating systems,
 * browser distributions, browser locales, screen resolutions, and geographic regions.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered visitors analytics view.
 */
export default async function AnalyticsVisitorsPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const t = await getTranslations({ locale, namespace: "analytics" });
  const site = await getActiveSite();
  if (!site) notFound();

  const bounds = getDateRangeBounds(sp.range);
  const filterCondition = buildAnalyticsFilterConditions(
    site.id,
    bounds.start,
    bounds.end,
    sp
  );
  const db = getDb();

  const getFilterHref = (key: string, val: string) => {
    const params = new URLSearchParams();
    if (sp.range) params.set("range", sp.range);
    if (sp.country && key !== "country") params.set("country", sp.country);
    if (sp.browser && key !== "browser") params.set("browser", sp.browser);
    if (sp.device && key !== "device") params.set("device", sp.device);
    if (sp.os && key !== "os") params.set("os", sp.os);
    params.set(key, val);
    const qs = params.toString();
    return `/admin/analytics/visitors${qs ? `?${qs}` : ""}`;
  };

  // Devices
  const deviceHits = db
    .select({
      device: analytics.device,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.device)
    .all();

  const totalDeviceViews = deviceHits.reduce((acc, curr) => acc + curr.count, 0);
  const deviceItems: BarChartItem[] = deviceHits.map((d) => ({
    label: t(d.device === "mobile" ? "mobile" : d.device === "tablet" ? "tablet" : "desktop"),
    value: d.count,
    percentage: totalDeviceViews > 0 ? Math.round((d.count / totalDeviceViews) * 100) : 0,
    color: d.device === "mobile" ? "#10b981" : d.device === "tablet" ? "#8b5cf6" : "#3b82f6",
    href: d.device ? getFilterHref("device", d.device) : undefined,
  }));

  // Operating Systems
  const osHits = db
    .select({
      os: analytics.os,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.os)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const totalOsViews = osHits.reduce((acc, curr) => acc + curr.count, 0);
  const osItems: BarChartItem[] = osHits.map((o) => ({
    label: o.os || t("otherBrowser"),
    value: o.count,
    percentage: totalOsViews > 0 ? Math.round((o.count / totalOsViews) * 100) : 0,
    color: "#6366f1",
    href: o.os && o.os !== "Other" ? getFilterHref("os", o.os) : undefined,
  }));

  // Browsers
  const browserHits = db
    .select({
      browser: analytics.browser,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.browser)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const totalBrowserViews = browserHits.reduce((acc, curr) => acc + curr.count, 0);
  const browserItems: BarChartItem[] = browserHits.map((b) => ({
    label: b.browser || t("otherBrowser"),
    value: b.count,
    percentage: totalBrowserViews > 0 ? Math.round((b.count / totalBrowserViews) * 100) : 0,
    color: "#ec4899",
    href: b.browser && b.browser !== "Other" ? getFilterHref("browser", b.browser) : undefined,
  }));

  // Languages
  const langHits = db
    .select({
      language: analytics.language,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.language)
    .orderBy(desc(sql`count(*)`))
    .limit(6)
    .all();

  const totalLangViews = langHits.reduce((acc, curr) => acc + curr.count, 0);
  const langItems: BarChartItem[] = langHits.map((l) => ({
    label: l.language || t("globalUnknown"),
    value: l.count,
    percentage: totalLangViews > 0 ? Math.round((l.count / totalLangViews) * 100) : 0,
    color: "#14b8a6",
  }));

  // Screen Resolutions
  const screenHits = db
    .select({
      width: analytics.screenWidth,
      height: analytics.screenHeight,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND screen_width IS NOT NULL AND screen_height IS NOT NULL`)
    .groupBy(analytics.screenWidth, analytics.screenHeight)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();

  const screenRows: ScreenRow[] = screenHits.map((s) => ({
    resolution: `${s.width} × ${s.height}`,
    views: s.count,
  }));

  // Countries & Cities
  const geoHits = db
    .select({
      country: analytics.country,
      city: analytics.city,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.country, analytics.city)
    .orderBy(desc(sql`count(*)`))
    .limit(20)
    .all();

  const geoRows: GeoRow[] = geoHits.map((g) => ({
    country: g.country || t("globalUnknown"),
    city: g.city || "-",
    views: g.count,
  }));

  const geoColumns: ColumnDef<GeoRow>[] = [
    {
      key: "country",
      header: t("geoDistribution"),
      render: (row) =>
        row.country && row.country !== t("globalUnknown") ? (
          <a
            href={getFilterHref("country", row.country)}
            className="font-semibold text-text hover:text-accent hover:underline"
            title={t("filterBy", { name: row.country })}
          >
            {row.country}
          </a>
        ) : (
          <span className="font-semibold text-text">{row.country}</span>
        ),
    },
    {
      key: "city",
      header: t("city"),
      render: (row) => <span className="text-text-muted">{row.city}</span>,
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.views.toLocaleString()}</span>,
    },
  ];

  const screenColumns: ColumnDef<ScreenRow>[] = [
    {
      key: "resolution",
      header: t("screenResolutions"),
      render: (row) => <span className="font-mono font-semibold text-text">{row.resolution}</span>,
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.views.toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Demographics Cards (Devices, OS, Browsers, Languages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Devices */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Monitor className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-text">{t("devicesAndBrowsers")}</h3>
          </div>
          <BarChart items={deviceItems} orientation="horizontal" emptyMessage={t("noDevices")} />
        </div>

        {/* Operating Systems */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Laptop className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-text">{t("operatingSystems")}</h3>
          </div>
          <BarChart items={osItems} orientation="horizontal" emptyMessage={t("noDevices")} />
        </div>

        {/* Browsers */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Globe className="w-4 h-4 text-pink-500" />
            <h3 className="text-xs font-bold text-text">{t("topBrowsers")}</h3>
          </div>
          <BarChart items={browserItems} orientation="horizontal" emptyMessage={t("noDevices")} />
        </div>

        {/* Languages */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Languages className="w-4 h-4 text-teal-500" />
            <h3 className="text-xs font-bold text-text">{t("languages")}</h3>
          </div>
          <BarChart items={langItems} orientation="horizontal" emptyMessage={t("noDevices")} />
        </div>
      </div>

      {/* Screen Resolutions and Geo Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Screen Resolutions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold text-text">{t("screenResolutions")}</h3>
          </div>
          <DataTable
            columns={screenColumns}
            data={screenRows}
            emptyMessage={t("noDevices")}
            rowKey={(r) => r.resolution}
          />
        </div>

        {/* Geographic Distribution */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-text">{t("geoDistribution")}</h3>
          </div>
          <DataTable
            columns={geoColumns}
            data={geoRows}
            emptyMessage={t("noGeo")}
            rowKey={(r, i) => `${r.country}-${r.city}-${i}`}
          />
        </div>
      </div>
    </div>
  );
}
