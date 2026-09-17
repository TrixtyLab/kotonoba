import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics, posts, pages } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { sql, desc, eq, and } from "drizzle-orm";
import { Files, LogIn, LogOut, ArrowRight, ExternalLink, FileText, Globe } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  getDateRangeBounds,
  buildAnalyticsFilterConditions,
} from "@/lib/analytics/query";
import { DataTable, ColumnDef } from "@/components/admin/analytics/DataTable";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    range?: string;
    type?: "all" | "articles" | "pages" | "system";
    country?: string;
    browser?: string;
    device?: string;
    os?: string;
  }>;
}

interface PathRow {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgTime: string;
  bounceRate: string;
  targetId?: string;
  title?: string;
  contentType: "article" | "page" | "system";
}

/**
 * Detailed content performance view analyzing raw URL paths, unique readers, engagement dwell, and entry/exit patterns.
 *
 * @param {PageProps} props - Route parameters with active locale and query filters.
 * @returns {Promise<React.JSX.Element>} Rendered page views breakdown view.
 */
export default async function AnalyticsPagesPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const activeType = sp.type || "all";
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

  // Load site posts and pages for title and drilldown link resolution
  const sitePosts = db
    .select({ id: posts.id, title: posts.title, slug: posts.slug })
    .from(posts)
    .where(eq(posts.siteId, site.id))
    .all();

  const sitePages = db
    .select({ id: pages.id, title: pages.title, slug: pages.slug })
    .from(pages)
    .where(eq(pages.siteId, site.id))
    .all();

  const postSlugMap = new Map<string, { id: string; title: string }>();
  for (const p of sitePosts) {
    postSlugMap.set(p.slug, { id: p.id, title: p.title });
    postSlugMap.set(`/entry/${p.slug}`, { id: p.id, title: p.title });
  }

  const pageSlugMap = new Map<string, { id: string; title: string }>();
  for (const pg of sitePages) {
    pageSlugMap.set(pg.slug, { id: pg.id, title: pg.title });
    pageSlugMap.set(`/p/${pg.slug}`, { id: pg.id, title: pg.title });
  }

  // Aggregate paths with views, unique visitors, avg time on page, and bounce rate
  const pathStats = db
    .select({
      path: analytics.path,
      postId: sql<string | null>`max(post_id)`,
      pageId: sql<string | null>`max(page_id)`,
      views: sql<number>`count(*)`,
      uniqueVisitors: sql<number>`count(distinct ip_hash)`,
      avgTimeSeconds: sql<number>`coalesce(avg(nullif(time_on_page, 0)), 0)`,
      totalHits: sql<number>`count(*)`,
      bouncedHits: sql<number>`sum(case when time_on_page < 10 then 1 else 0 end)`,
    })
    .from(analytics)
    .where(filterCondition)
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(100)
    .all();

  let allTableData: PathRow[] = pathStats.map((p) => {
    const avgSec = Math.round(p.avgTimeSeconds);
    const m = Math.floor(avgSec / 60);
    const s = avgSec % 60;
    const avgFormatted = avgSec > 0 ? (m > 0 ? `${m}m ${s}s` : `${s}s`) : "< 5s";
    const bouncePct = p.totalHits > 0 ? Math.round(((p.bouncedHits || 0) / p.totalHits) * 100) : 0;

    let contentType: "article" | "page" | "system" = "system";
    let targetId: string | undefined = undefined;
    let title: string | undefined = undefined;

    const postMatch = postSlugMap.get(p.path);
    if (postMatch || p.postId) {
      contentType = "article";
      targetId = postMatch?.id || p.postId || undefined;
      title = postMatch?.title;
    } else {
      const pageMatch = pageSlugMap.get(p.path);
      if (pageMatch || p.pageId) {
        contentType = "page";
        targetId = pageMatch?.id || p.pageId || undefined;
        title = pageMatch?.title;
      }
    }

    return {
      path: p.path,
      views: p.views,
      uniqueVisitors: p.uniqueVisitors,
      avgTime: avgFormatted,
      bounceRate: `${bouncePct}%`,
      targetId,
      title,
      contentType,
    };
  });

  // Filter table by content type tab
  if (activeType === "articles") {
    allTableData = allTableData.filter((d) => d.contentType === "article");
  } else if (activeType === "pages") {
    allTableData = allTableData.filter((d) => d.contentType === "page");
  } else if (activeType === "system") {
    allTableData = allTableData.filter((d) => d.contentType === "system");
  }

  // Entry and Exit pages by session
  const entryPages = db
    .select({
      path: analytics.path,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(
      sql`${filterCondition} AND (analytics.id IN (
        SELECT id FROM analytics a2 
        WHERE a2.site_id = ${site.id} 
        GROUP BY coalesce(nullif(a2.session_id, ''), a2.ip_hash) 
        HAVING min(a2.created_at)
      ))`
    )
    .groupBy(analytics.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
    .all();

  const columns: ColumnDef<PathRow>[] = [
    {
      key: "path",
      header: t("paths"),
      render: (row) => (
        <div className="flex items-center gap-2 max-w-md">
          <div className="min-w-0 flex-1">
            {row.title ? (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-text truncate text-xs">{row.title}</span>
                <span
                  className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    row.contentType === "article"
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-emerald-500/10 text-emerald-500"
                  }`}
                >
                  {row.contentType}
                </span>
              </div>
            ) : null}
            <span className="font-mono text-[11px] text-text-muted truncate block" title={row.path}>
              {row.path}
            </span>
          </div>

          {row.targetId ? (
            <Link
              href={`/admin/analytics/${row.targetId}`}
              className="p-1 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
              title={t("viewDetailedAnalytics")}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "views",
      header: t("views"),
      align: "right",
      render: (row) => <span className="tabular-nums font-bold text-text">{row.views.toLocaleString()}</span>,
    },
    {
      key: "uniqueVisitors",
      header: t("visitors"),
      align: "right",
      render: (row) => <span className="tabular-nums text-text-muted">{row.uniqueVisitors.toLocaleString()}</span>,
    },
    {
      key: "avgTime",
      header: t("avgDuration"),
      align: "right",
      render: (row) => <span className="tabular-nums text-text-muted">{row.avgTime}</span>,
    },
    {
      key: "bounceRate",
      header: t("bounceRate"),
      align: "right",
      render: (row) => (
        <span className="tabular-nums font-medium text-text-muted">{row.bounceRate}</span>
      ),
    },
  ];

  // Tab helper to build links preserving existing searchParams
  const getTabHref = (typeVal: string) => {
    const params = new URLSearchParams();
    if (sp.range) params.set("range", sp.range);
    if (sp.country) params.set("country", sp.country);
    if (sp.browser) params.set("browser", sp.browser);
    if (sp.device) params.set("device", sp.device);
    if (sp.os) params.set("os", sp.os);
    if (typeVal !== "all") params.set("type", typeVal);
    const qs = params.toString();
    return `/admin/analytics/pages${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Primary Content Table with Sub-Tabs */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border">
          <div className="flex items-center gap-2">
            <Files className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-text">{t("allContent")}</h2>
          </div>

          {/* Sub-Tabs: All Content | Articles | Static Pages | System Paths */}
          <div className="flex items-center gap-1 bg-surface border border-border p-1 rounded-xl text-xs">
            <Link
              href={getTabHref("all")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                activeType === "all"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              {t("allContent")}
            </Link>
            <Link
              href={getTabHref("articles")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                activeType === "articles"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              {t("articles")}
            </Link>
            <Link
              href={getTabHref("pages")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                activeType === "pages"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              {t("pages")}
            </Link>
            <Link
              href={getTabHref("system")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                activeType === "system"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/80"
              }`}
            >
              {t("paths")}
            </Link>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={allTableData}
          emptyMessage={t("noPathsYet")}
          rowKey={(r) => r.path}
        />
      </div>

      {/* Entry & Exit Pages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Entry Pages */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <LogIn className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-text">{t("entryPages")}</h3>
          </div>
          <div className="divide-y divide-border/60">
            {entryPages.length > 0 ? (
              entryPages.map((p) => (
                <div key={p.path} className="py-2 flex items-center justify-between text-xs gap-2">
                  <span className="font-mono text-text truncate max-w-[75%]" title={p.path}>
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

        {/* Exit Pages */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <LogOut className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-bold text-text">{t("exitPages")}</h3>
          </div>
          <div className="divide-y divide-border/60">
            {allTableData.slice(0, 10).map((p) => (
              <div key={p.path} className="py-2 flex items-center justify-between text-xs gap-2">
                <span className="font-mono text-text truncate max-w-[75%]" title={p.path}>
                  {p.path}
                </span>
                <span className="font-mono font-bold text-text tabular-nums shrink-0">
                  {p.bounceRate}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
