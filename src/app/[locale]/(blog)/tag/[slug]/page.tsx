import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, tags, postTags, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/PostCard";
import { Link } from "@/i18n/routing";
import { Tag as TagIcon, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getActiveSite();
  const db = getDb();
  const tag = db.select().from(tags).where(eq(tags.slug, slug)).get();
  return {
    title: tag ? `#${tag.name} — ${site?.name || "Blog"}` : "Tag",
    description: `Articles tagged with #${tag?.name}`,
  };
}

/**
 * Tag archive page listing articles associated with a specific hashtag.
 */
export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const tag = db.select().from(tags).where(and(eq(tags.siteId, site.id), eq(tags.slug, slug))).get();
  if (!tag) notFound();

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
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(postTags.tagId, tag.id), eq(posts.status, "published")))
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
        <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase tracking-wider">
          <TagIcon className="w-4 h-4" />
          <span>Tag Archive</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text">#{tag.name}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {matchingPosts.map((p) => (
          <PostCard key={p.id} post={p} locale={locale} />
        ))}
      </div>

      {matchingPosts.length === 0 && (
        <div className="text-center py-16 text-text-muted text-sm">
          No articles associated with this tag yet.
        </div>
      )}
    </div>
  );
}
