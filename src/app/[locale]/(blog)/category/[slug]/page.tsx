import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, categories, postCategories, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/PostCard";
import { Link } from "@/i18n/routing";
import { Folder, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getActiveSite();
  const db = getDb();
  const cat = db.select().from(categories).where(eq(categories.slug, slug)).get();
  return {
    title: cat ? `${cat.name} — ${site?.name || "Blog"}` : "Category",
    description: cat?.description || `Articles in category ${cat?.name}`,
  };
}

/**
 * Category archive page displaying articles filed under a specific category taxonomy.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const cat = db.select().from(categories).where(and(eq(categories.siteId, site.id), eq(categories.slug, slug))).get();
  if (!cat) notFound();

  const matchingPosts = db
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
    .from(postCategories)
    .innerJoin(posts, eq(postCategories.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(postCategories.categoryId, cat.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .all();

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all articles
      </Link>

      <div className="glass p-6 sm:p-8 rounded-2xl border border-border space-y-2">
        <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
          <Folder className="w-4 h-4" />
          <span>Category</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text">{cat.name}</h1>
        {cat.description && <p className="text-sm text-text-muted">{cat.description}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {matchingPosts.map((p) => (
          <PostCard key={p.id} post={p} locale={locale} />
        ))}
      </div>

      {matchingPosts.length === 0 && (
        <div className="text-center py-16 text-text-muted text-sm">
          No articles published in this category yet.
        </div>
      )}
    </div>
  );
}
