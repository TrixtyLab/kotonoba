import { getTranslations } from "next-intl/server";
import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, pages, categories, tags, analytics, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getStorageStatus } from "@/lib/storage";
import { getLocalizedText } from "@/lib/utils/localization";
import {
  FileText, CheckCircle2, Clock, Eye, Plus,
  FolderTree, Settings, Sparkles, TrendingUp, ArrowRight,
  Image as ImageIcon, HardDrive, Cloud, Compass, Globe, Files
} from "lucide-react";

/**
 * Main administrative dashboard overview displaying publication metrics, recent post logs, storage status, and quick action shortcuts.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving to route parameters with active locale code.
 * @returns {Promise<React.JSX.Element>} React JSX dashboard overview element.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const site = await getActiveSite();
  const db = getDb();

  const siteId = site?.id || "default";
  const storageStatus = getStorageStatus();

  const postStats = db
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when status = 'published' then 1 else 0 end)`,
      drafts: sql<number>`sum(case when status = 'draft' then 1 else 0 end)`,
      totalViews: sql<number>`sum(views)`,
    })
    .from(posts)
    .where(eq(posts.siteId, siteId))
    .get();

  const pageStats = db
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when status = 'published' then 1 else 0 end)`,
      drafts: sql<number>`sum(case when status = 'draft' then 1 else 0 end)`,
      totalViews: sql<number>`sum(views)`,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .get();

  const categoryCount = db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
    .where(eq(categories.siteId, siteId))
    .get();

  const recentPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      views: posts.views,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      coverImage: posts.coverImage,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.siteId, siteId))
    .orderBy(desc(posts.createdAt))
    .limit(5)
    .all();

  const totalHits = db
    .select({ count: sql<number>`count(*)` })
    .from(analytics)
    .where(eq(analytics.siteId, siteId))
    .get();

  const metrics = [
    {
      label: t("totalPosts"),
      value: (postStats?.total || 0) + (pageStats?.total || 0),
      icon: FileText,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: t("publishedPosts"),
      value: (postStats?.published || 0) + (pageStats?.published || 0),
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: t("draftPosts"),
      value: (postStats?.drafts || 0) + (pageStats?.drafts || 0),
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: t("totalViews"),
      value: (postStats?.totalViews || 0) + (pageStats?.totalViews || 0) + (totalHits?.count || 0),
      icon: Eye,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-surface border border-border rounded-xl shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{t("dashboardTitle")}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("managing")} <span className="font-semibold text-text">{getLocalizedText(site?.name, locale)}</span> ({site?.domain})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/media">
            <Button size="sm" variant="outline" icon={<ImageIcon className="w-3.5 h-3.5 text-accent" />}>
              {t("media")}
            </Button>
          </Link>
          <Link href="/admin/posts/new">
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
              {t("newPost")}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3.5 shadow-xs"
            >
              <div className={`w-10 h-10 rounded-lg ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-text-muted truncate">{m.label}</p>
                <p className="text-xl font-bold text-text tabular-nums mt-0.5">{m.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Articles */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-text">{t("recentPosts")}</h2>
              <p className="text-xs text-text-muted mt-0.5">{t("recentPostsDesc")}</p>
            </div>
            <Link
              href="/admin/posts"
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
            >
              {t("viewAll")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border/60">
            {recentPosts.map((post) => (
              <div key={post.id} className="py-3 flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {post.coverImage ? (
                    <div className="w-10 h-10 rounded-lg border border-border overflow-hidden shrink-0 bg-surface-hover/30">
                      <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-border bg-surface-hover/40 flex items-center justify-center text-text-muted shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="text-xs font-semibold text-text group-hover:text-accent transition-colors block truncate"
                    >
                      {post.title}
                    </Link>
                    <p className="text-[11px] text-text-muted flex items-center gap-2">
                      <span>{post.publishedAt ? formatDate(post.publishedAt, locale) : t("statusDraft")}</span>
                      <span>•</span>
                      <span>{t("viewsCount", { count: post.views })}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge variant={post.status === "published" ? "success" : "warning"}>
                    {post.status === "published" ? t("statusPublished") : t("statusDraft")}
                  </Badge>
                  <Link href={`/admin/posts/${post.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      {tc("edit")}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}

            {recentPosts.length === 0 && (
              <div className="py-10 text-center text-xs text-text-muted space-y-1">
                <FileText className="w-6 h-6 opacity-30 mx-auto" />
                <p>{t("noPostsYet")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="lg:col-span-4 space-y-5">
          {/* Storage Status */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
              {storageStatus.provider === "r2" ? (
                <Cloud className="w-4 h-4 text-accent" />
              ) : (
                <HardDrive className="w-4 h-4 text-text-muted" />
              )}
              <span>{t("storageEngine")}</span>
            </h3>

            <div className="p-3 rounded-lg bg-surface-hover/40 border border-border text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("engine")}:</span>
                <span className="font-semibold text-text">
                  {storageStatus.provider === "r2" ? "Cloudflare R2" : t("localFolder")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("status")}:</span>
                <span className="font-semibold text-emerald-500">{t("operational")}</span>
              </div>
            </div>

            <Link href="/admin/media" className="block">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <ImageIcon className="w-3.5 h-3.5 mr-1 text-accent" />
                {t("mediaLibrary")}
              </Button>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-2.5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border">
              {t("quickActions")}
            </h3>
            <div className="space-y-1.5 text-xs">
              <Link
                href="/admin/posts/new"
                className="p-2.5 rounded-lg bg-surface-hover/50 hover:bg-surface-hover flex items-center gap-2.5 font-medium text-text transition-colors"
              >
                <Plus className="w-4 h-4 text-accent shrink-0" />
                <span>{t("writeArticle")}</span>
              </Link>
              <Link
                href="/admin/settings"
                className="p-2.5 rounded-lg bg-surface-hover/50 hover:bg-surface-hover flex items-center gap-2.5 font-medium text-text transition-colors"
              >
                <Compass className="w-4 h-4 text-accent shrink-0" />
                <span>{t("configureNavbar")}</span>
              </Link>
              <Link
                href="/admin/categories"
                className="p-2.5 rounded-lg bg-surface-hover/50 hover:bg-surface-hover flex items-center gap-2.5 font-medium text-text transition-colors"
              >
                <FolderTree className="w-4 h-4 text-accent shrink-0" />
                <span>{t("categoriesCount", { count: categoryCount?.count || 0 })}</span>
              </Link>
              <Link
                href="/admin/analytics"
                className="p-2.5 rounded-lg bg-surface-hover/50 hover:bg-surface-hover flex items-center gap-2.5 font-medium text-text transition-colors"
              >
                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t("statsAndTraffic")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
