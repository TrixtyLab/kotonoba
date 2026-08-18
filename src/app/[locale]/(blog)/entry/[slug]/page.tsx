import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, users, categories, tags, postCategories, postTags } from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/Badge";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { PostCard } from "@/components/blog/PostCard";
import { Link } from "@/i18n/routing";
import { Calendar, Clock, ArrowLeft, User } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getActiveSite();
  if (!site) return { title: "Article Not Found" };

  const db = getDb();
  const post = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.slug, slug), eq(posts.status, "published")))
    .get();

  if (!post) return { title: "Article Not Found" };

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}/entry/${post.slug}`;

  return {
    title: `${post.title} — ${site.name}`,
    description: post.excerpt || `${post.title} on ${site.name}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      url: canonicalUrl,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || undefined,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

/**
 * Public article detail page rendering rich markdown content, inline Mermaid diagrams,
 * responsive Table of Contents, social share buttons, author information, and JSON-LD schema.
 */
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const post = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      contentMd: posts.contentMd,
      contentHtml: posts.contentHtml,
      excerpt: posts.excerpt,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
      views: posts.views,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.siteId, site.id), eq(posts.slug, slug), eq(posts.status, "published")))
    .get();

  if (!post) notFound();

  const assignedCategories = db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, post.id))
    .all();

  const assignedTags = db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id))
    .all();

  const relatedPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published"), ne(posts.id, post.id)))
    .orderBy(desc(posts.publishedAt))
    .limit(3)
    .all();

  const readTime = Math.max(1, Math.ceil((post.contentMd?.length || 1000) / 800));
  const postUrl = `https://${site.domain}/entry/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage || undefined,
    datePublished: post.publishedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: post.authorName || "Author",
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
  };

  const mermaidDiagrams: string[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  const rawText = post.contentMd || "";
  while ((match = regex.exec(rawText)) !== null) {
    mermaidDiagrams.push(match[1].trim());
  }

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all articles
      </Link>

      <header className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          {assignedCategories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`}>
              <Badge variant="primary">{c.name}</Badge>
            </Link>
          ))}
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-text tracking-tight leading-tight">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-base sm:text-lg text-text-muted leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-border/60 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="font-semibold text-text">{post.authorName || "Author"}</span>
            </div>
            {post.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(post.publishedAt, locale)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {readTime} min read
            </span>
          </div>

          <ShareButtons url={postUrl} title={post.title} />
        </div>
      </header>

      {post.coverImage && (
        <div className="w-full max-h-[460px] rounded-2xl overflow-hidden border border-border shadow-xl">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <article className="lg:col-span-8">
          <div
            className="prose-blog text-text/90"
            dangerouslySetInnerHTML={{ __html: post.contentHtml || post.contentMd || "" }}
          />

          {mermaidDiagrams.length > 0 && (
            <div className="my-8 space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted pb-2 border-b border-border/50">
                Diagrams ({mermaidDiagrams.length})
              </h3>
              {mermaidDiagrams.map((chart, idx) => (
                <MermaidRenderer key={idx} chart={chart} />
              ))}
            </div>
          )}

          {assignedTags.length > 0 && (
            <div className="pt-8 mt-12 border-t border-border flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-text-muted">Tags:</span>
              {assignedTags.map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="text-xs px-3 py-1 rounded-full bg-surface-hover hover:bg-primary/15 hover:text-primary transition-colors border border-border"
                >
                  #{t.name}
                </Link>
              ))}
            </div>
          )}
        </article>

        <aside className="lg:col-span-4 space-y-6">
          <TableOfContents contentHtml={post.contentHtml || post.contentMd || ""} />
        </aside>
      </div>

      {relatedPosts.length > 0 && (
        <section className="pt-12 border-t border-border space-y-6">
          <h3 className="text-xl font-bold text-text">More Articles You Might Like</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {relatedPosts.map((rp) => (
              <PostCard key={rp.id} post={rp} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
