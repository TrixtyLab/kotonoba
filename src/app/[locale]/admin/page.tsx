import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, categories, tags, analytics, users } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FileText, CheckCircle, Clock, Eye, Plus,
  FolderTree, Settings, Sparkles, TrendingUp, ArrowRight
} from "lucide-react";

/**
 * Admin dashboard overview displaying site KPIs, recent publishing activity, and quick navigation actions.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  const db = getDb();

  const siteId = site?.id || "default";

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

  const recentPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      views: posts.views,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
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
      label: "Total Articles",
      value: postStats?.total || 0,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Published",
      value: postStats?.published || 0,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Drafts",
      value: postStats?.drafts || 0,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Total Page Views",
      value: (postStats?.totalViews || 0) + (totalHits?.count || 0),
      icon: Eye,
      color: "text-accent",
      bg: "bg-accent/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-text-muted">
            Managing <span className="font-semibold text-text">{site?.name}</span> ({site?.domain})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/posts/new">
            <Button size="sm" variant="primary" icon={<Plus className="w-4 h-4" />}>
              New Article
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="glass p-5 rounded-xl border border-border flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{m.label}</p>
                <p className="text-2xl font-bold text-text tabular-nums">{m.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-bold text-text">Recent Articles</h2>
            <Link href="/admin/posts" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/40 overflow-x-auto">
            {recentPosts.map((post) => (
              <div key={post.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="text-sm font-semibold text-text hover:text-primary transition-colors block truncate"
                  >
                    {post.title}
                  </Link>
                  <p className="text-[11px] text-text-muted">
                    {post.publishedAt ? `Published ${formatDate(post.publishedAt, locale)}` : "Draft"} • {post.views} views
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={post.status === "published" ? "success" : "warning"}>
                    {post.status}
                  </Badge>
                  <Link href={`/admin/posts/${post.id}`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </Link>
                </div>
              </div>
            ))}
            {recentPosts.length === 0 && (
              <div className="py-8 text-center text-xs text-text-muted">No articles created yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-bold text-text pb-2 border-b border-border/50">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <Link
                href="/admin/posts/new"
                className="p-2.5 rounded-lg bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 font-semibold text-text"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>Compose New Post</span>
              </Link>
              <Link
                href="/admin/categories"
                className="p-2.5 rounded-lg bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 font-semibold text-text"
              >
                <FolderTree className="w-4 h-4 text-secondary" />
                <span>Manage Categories</span>
              </Link>
              <Link
                href="/admin/settings"
                className="p-2.5 rounded-lg bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 font-semibold text-text"
              >
                <Settings className="w-4 h-4 text-accent" />
                <span>Site Settings & AI</span>
              </Link>
              <Link
                href="/admin/analytics"
                className="p-2.5 rounded-lg bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2.5 font-semibold text-text"
              >
                <TrendingUp className="w-4 h-4 text-success" />
                <span>Traffic Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
