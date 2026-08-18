import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BarChart3, TrendingUp, Eye, Globe, ExternalLink, Compass } from "lucide-react";
import { Link } from "@/i18n/routing";

/**
 * Traffic and performance analytics dashboard presenting aggregate views, top posts, and referrer breakdown.
 */
export default async function AdminAnalyticsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();

  const totalPageViews = db
    .select({ count: sql<number>`count(*)` })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .get()?.count || 0;

  const topPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      views: posts.views,
    })
    .from(posts)
    .where(eq(posts.siteId, site.id))
    .orderBy(desc(posts.views))
    .limit(10)
    .all();

  const topReferrers = db
    .select({
      referrer: analytics.referrer,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .groupBy(analytics.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();

  const topCountries = db
    .select({
      country: analytics.country,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .where(eq(analytics.siteId, site.id))
    .groupBy(analytics.country)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();

  const maxPostViews = Math.max(1, ...topPosts.map((p) => p.views));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text tracking-tight">Traffic & Performance Analytics</h1>
        <p className="text-xs text-text-muted">Privacy-focused metrics for <span className="font-semibold text-text">{site.name}</span></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total Recorded Hits</p>
            <p className="text-2xl font-bold text-text tabular-nums">{totalPageViews}</p>
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Top Article Views</p>
            <p className="text-2xl font-bold text-text tabular-nums">{topPosts[0]?.views || 0}</p>
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Referrers</p>
            <p className="text-2xl font-bold text-text tabular-nums">{topReferrers.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass p-6 rounded-xl border border-border space-y-4">
          <h2 className="text-base font-bold text-text flex items-center gap-2 pb-3 border-b border-border/50">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Top Performing Articles</span>
          </h2>

          <div className="space-y-3">
            {topPosts.map((p) => {
              const pct = Math.round((p.views / maxPostViews) * 100);

              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Link
                      href={`/admin/posts/${p.id}`}
                      className="font-medium text-text hover:text-primary transition-colors truncate max-w-sm"
                    >
                      {p.title}
                    </Link>
                    <span className="font-mono text-text-muted shrink-0 ml-2">{p.views} views</span>
                  </div>
                  <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topPosts.length === 0 && (
              <p className="text-xs text-text-muted py-6 text-center">No traffic recorded yet.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass p-5 rounded-xl border border-border space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-border/50 flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Traffic Sources</span>
            </h3>
            <div className="space-y-2 text-xs">
              {topReferrers.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text truncate max-w-[180px]">
                    {r.referrer ? r.referrer.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "Direct / Search"}
                  </span>
                  <span className="font-mono text-text-muted">{r.count}</span>
                </div>
              ))}
              {topReferrers.length === 0 && (
                <p className="text-xs text-text-muted py-2">No referrer data yet.</p>
              )}
            </div>
          </div>

          <div className="glass p-5 rounded-xl border border-border space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-border/50 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Geographic Distribution</span>
            </h3>
            <div className="space-y-2 text-xs">
              {topCountries.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-text">{c.country || "Global / Unspecified"}</span>
                  <span className="font-mono text-text-muted">{c.count}</span>
                </div>
              ))}
              {topCountries.length === 0 && (
                <p className="text-xs text-text-muted py-2">No geographic data yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
