import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc } from "drizzle-orm";
import { Compass, Share2, Tag, Layers } from "lucide-react";
import {
  getDateRangeBounds,
  buildAnalyticsFilterConditions,
  cleanReferrerDomain,
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

interface ReferrerRow {
  domain: string;
  views: number;
}

interface UtmRow {
  name: string;
  views: number;
  visitors: number;
}

/**
 * Classifies a raw HTTP referrer into high-level marketing channels (Direct, Search, Social, Email, Referral).
 *
 * @param {string | null} referrer - Raw HTTP Referrer string.
 * @param {string | null} utmMedium - Optional UTM medium tag.
 * @returns {"direct" | "search" | "social" | "email" | "referral"} Standardized marketing channel bucket.
 */
function classifyChannel(
  referrer: string | null,
  utmMedium: string | null
): "direct" | "search" | "social" | "email" | "referral" {
  if (utmMedium?.toLowerCase() === "email") return "email";
  if (!referrer || !referrer.trim()) return "direct";

  const ref = referrer.toLowerCase();
  if (/google\.|bing\.|yahoo\.|duckduckgo\.|ecosia\.|baidu\.|yandex\./.test(ref)) {
    return "search";
  }
  if (/twitter\.|x\.com|t\.co|facebook\.|instagram\.|linkedin\.|reddit\.|pinterest\.|threads\.net|bsky\.app|bluesky|tiktok\.|youtube\./.test(ref)) {
    return "social";
  }
  if (/mail\.|outlook\.|gmail\.|newsletter|pixel/.test(ref)) {
    return "email";
  }
  return "referral";
}

/**
 * Traffic acquisition view analyzing incoming referrers, categorized marketing channels, and UTM attribution parameters.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered traffic sources view.
 */
export default async function AnalyticsSourcesPage({
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

  // All hits for channel classification and referrer aggregation
  const rawReferrers = db
    .select({
      referrer: analytics.referrer,
      utmMedium: analytics.utmMedium,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.referrer, analytics.utmMedium)
    .all();

  const channelCounts = { direct: 0, search: 0, social: 0, email: 0, referral: 0 };
  const referrerMap = new Map<string, number>();
  let totalChannelViews = 0;

  for (const r of rawReferrers) {
    const channel = classifyChannel(r.referrer, r.utmMedium);
    channelCounts[channel] += r.count;
    totalChannelViews += r.count;

    const domain = cleanReferrerDomain(r.referrer);
    referrerMap.set(domain, (referrerMap.get(domain) || 0) + r.count);
  }

  const channelItems: BarChartItem[] = [
    {
      label: t("channelDirect"),
      value: channelCounts.direct,
      percentage: totalChannelViews > 0 ? Math.round((channelCounts.direct / totalChannelViews) * 100) : 0,
      color: "#64748b",
    },
    {
      label: t("channelSearch"),
      value: channelCounts.search,
      percentage: totalChannelViews > 0 ? Math.round((channelCounts.search / totalChannelViews) * 100) : 0,
      color: "#3b82f6",
    },
    {
      label: t("channelSocial"),
      value: channelCounts.social,
      percentage: totalChannelViews > 0 ? Math.round((channelCounts.social / totalChannelViews) * 100) : 0,
      color: "#ec4899",
    },
    {
      label: t("channelEmail"),
      value: channelCounts.email,
      percentage: totalChannelViews > 0 ? Math.round((channelCounts.email / totalChannelViews) * 100) : 0,
      color: "#10b981",
    },
    {
      label: t("channelReferral"),
      value: channelCounts.referral,
      percentage: totalChannelViews > 0 ? Math.round((channelCounts.referral / totalChannelViews) * 100) : 0,
      color: "#8b5cf6",
    },
  ];

  const referrerRows: ReferrerRow[] = Array.from(referrerMap.entries())
    .map(([domain, views]) => ({ domain, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  // UTM Campaigns
  const utmCampaigns = db
    .select({
      name: analytics.utmCampaign,
      views: sql<number>`count(*)`,
      visitors: sql<number>`count(distinct ip_hash)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND utm_campaign IS NOT NULL AND utm_campaign != ''`)
    .groupBy(analytics.utmCampaign)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all() as UtmRow[];

  // UTM Sources
  const utmSources = db
    .select({
      name: analytics.utmSource,
      views: sql<number>`count(*)`,
      visitors: sql<number>`count(distinct ip_hash)`,
    })
    .from(analytics)
    .where(sql`${filterCondition} AND utm_source IS NOT NULL AND utm_source != ''`)
    .groupBy(analytics.utmSource)
    .orderBy(desc(sql`count(*)`))
    .limit(15)
    .all() as UtmRow[];

  const referrerColumns: ColumnDef<ReferrerRow>[] = [
    {
      key: "domain",
      header: t("referrers"),
      render: (row) => <span className="font-semibold text-text">{row.domain}</span>,
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.views.toLocaleString()}</span>,
    },
  ];

  const getFilterHref = (key: string, val: string) => {
    const params = new URLSearchParams();
    if (sp.range) params.set("range", sp.range);
    if (sp.country) params.set("country", sp.country);
    if (sp.browser) params.set("browser", sp.browser);
    if (sp.device) params.set("device", sp.device);
    if (sp.os) params.set("os", sp.os);
    params.set(key, val);
    const qs = params.toString();
    return `/admin/analytics/sources${qs ? `?${qs}` : ""}`;
  };

  const campaignColumns: ColumnDef<UtmRow>[] = [
    {
      key: "name",
      header: t("pixelName"),
      render: (row) => (
        <a
          href={getFilterHref("campaign", row.name)}
          className="font-mono font-semibold text-text hover:text-accent hover:underline"
          title={t("filterBy", { name: row.name })}
        >
          {row.name}
        </a>
      ),
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.views.toLocaleString()}</span>,
    },
    {
      key: "visitors",
      header: t("visitors"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.visitors.toLocaleString()}</span>,
    },
  ];

  const utmColumns: ColumnDef<UtmRow>[] = [
    {
      key: "name",
      header: t("pixelName"),
      render: (row) => <span className="font-mono font-semibold text-text">{row.name}</span>,
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="font-mono font-bold text-text tabular-nums">{row.views.toLocaleString()}</span>,
    },
    {
      key: "visitors",
      header: t("visitors"),
      align: "right",
      render: (row) => <span className="font-mono text-text-muted tabular-nums">{row.visitors.toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Channels Distribution & Referrers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Marketing Channels */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold text-text">{t("trafficSources")}</h3>
          </div>
          <BarChart items={channelItems} orientation="horizontal" emptyMessage={t("noReferrers")} />
        </div>

        {/* Top Referring Domains */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet-500" />
            <h3 className="text-xs font-bold text-text">{t("referrers")}</h3>
          </div>
          <DataTable
            columns={referrerColumns}
            data={referrerRows}
            emptyMessage={t("noReferrers")}
            rowKey={(r) => r.domain}
          />
        </div>
      </div>

      {/* UTM Campaigns & UTM Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Campaigns */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-text">{t("utmCampaignsHeader")}</h3>
          </div>
          <DataTable
            columns={campaignColumns}
            data={utmCampaigns}
            emptyMessage={t("noUtmCampaigns")}
            rowKey={(r) => r.name}
          />
        </div>

        {/* Sources */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-pink-500" />
            <h3 className="text-xs font-bold text-text">{t("utmSources")}</h3>
          </div>
          <DataTable
            columns={utmColumns}
            data={utmSources}
            emptyMessage={t("noUtmSources")}
            rowKey={(r) => r.name}
          />
        </div>
      </div>
    </div>
  );
}
