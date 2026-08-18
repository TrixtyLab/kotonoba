import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, categories, tags, postCategories, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/blog/PostCard";
import { Link } from "@/i18n/routing";
import { Sparkles, Folder, Tag as TagIcon } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getActiveSite();
  return {
    title: site ? `${site.name} — ${site.subtitle || "Blog"}` : "Kotonoba",
    description: site?.description || "A modern multi-tenant blog CMS",
  };
}

/**
 * Public homepage rendering featured banner article, responsive post grid,
 * category badges, and tag clouds for fast reader discovery.
 */
export default async function BlogHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();

  if (!site) {
    return (
      <div className="text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold text-text">No active blog configured.</h1>
        <p className="text-sm text-text-muted">Please visit the setup wizard or admin panel.</p>
      </div>
    );
  }

  const db = getDb();

  const allPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
      views: posts.views,
      pinned: posts.pinned,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.pinned), desc(posts.publishedAt))
    .all();

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();
  const allTags = db.select().from(tags).where(eq(tags.siteId, site.id)).all();

  const featuredPost = allPosts.find((p) => p.pinned) || allPosts[0] || null;
  const regularPosts = featuredPost ? allPosts.filter((p) => p.id !== featuredPost.id) : allPosts;

  return (
    <div className="space-y-12">
      {featuredPost && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="w-4 h-4" />
            <span>Featured Story</span>
          </div>
          <PostCard post={featuredPost} featured locale={locale} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h2 className="text-xl font-bold text-text">Latest Articles</h2>
            <span className="text-xs text-text-muted">{regularPosts.length} posts</span>
          </div>

          {regularPosts.length === 0 && !featuredPost && (
            <div className="p-12 text-center glass rounded-xl border border-border space-y-3">
              <p className="text-sm text-text-muted">No articles published yet.</p>
              <Link href="/admin/posts/new" className="text-xs font-semibold text-primary hover:underline">
                Write your first post in Admin →
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {regularPosts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="glass p-5 rounded-xl border border-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text pb-2 border-b border-border/50">
              <Folder className="w-4 h-4 text-primary" />
              <span>Explore Categories</span>
            </div>
            <div className="space-y-1.5">
              {allCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-text-muted">→</span>
                </Link>
              ))}
              {allCategories.length === 0 && (
                <p className="text-xs text-text-muted">No categories available.</p>
              )}
            </div>
          </div>

          <div className="glass p-5 rounded-xl border border-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text pb-2 border-b border-border/50">
              <TagIcon className="w-4 h-4 text-secondary" />
              <span>Popular Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface-hover text-text-muted hover:text-primary hover:bg-primary/10 border border-border transition-colors"
                >
                  #{t.name}
                </Link>
              ))}
              {allTags.length === 0 && (
                <p className="text-xs text-text-muted">No tags created yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
