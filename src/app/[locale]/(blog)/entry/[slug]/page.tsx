import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, users, categories, tags, postCategories, postTags } from "@/lib/db/schema";
import { eq, and, desc, lt, gt, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils/date";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { LikeButton } from "@/components/blog/LikeButton";
import { Link } from "@/i18n/routing";
import { Tag as TagIcon, Eye, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { renderPostContent } from "@/lib/utils/markdown";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Generates OpenGraph, Twitter, and canonical SEO metadata tags for a published blog post.
 *
 * @param props - Object containing route params with post slug and locale.
 * @returns Metadata object configured for search engines and social cards.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  const t = await getTranslations({ locale, namespace: "blog" });
  if (!site) return { title: t("noPosts") };

  const db = getDb();
  const post = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.slug, slug), eq(posts.status, "published")))
    .get();

  if (!post) return { title: t("noPosts") };

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}/entry/${post.slug}`;

  const siteName = getLocalizedText(site.name, locale);
  return {
    title: `${post.title} — ${siteName}`,
    description: post.excerpt || `${post.title} - ${siteName}`,
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
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Public single article reading view rendering formatted markdown HTML, social share buttons, like reaction triggers, and sequential post navigation.
 *
 * @param props - Object containing route params Promise with article slug.
 * @returns React JSX full article reading page.
 */
export default async function PostEntryPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });

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
      shortUrl: posts.shortUrl,
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

  const prevPost = post.publishedAt
    ? db
        .select({ title: posts.title, slug: posts.slug })
        .from(posts)
        .where(
          and(
            eq(posts.siteId, site.id),
            eq(posts.status, "published"),
            lt(posts.publishedAt, post.publishedAt)
          )
        )
        .orderBy(desc(posts.publishedAt))
        .limit(1)
        .get()
    : null;

  const nextPost = post.publishedAt
    ? db
        .select({ title: posts.title, slug: posts.slug })
        .from(posts)
        .where(
          and(
            eq(posts.siteId, site.id),
            eq(posts.status, "published"),
            gt(posts.publishedAt, post.publishedAt)
          )
        )
        .orderBy(asc(posts.publishedAt))
        .limit(1)
        .get()
    : null;

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();
  const latestPosts = db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .limit(5)
    .all();

  const postUrl = `https://${site.domain}/entry/${post.slug}`;
  const shareUrl = post.shortUrl || postUrl;

  const mermaidDiagrams: string[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  const rawText = post.contentMd || "";
  while ((match = regex.exec(rawText)) !== null) {
    mermaidDiagrams.push(match[1].trim());
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start w-full">
      {/* Left Column: Article Content */}
      <article className="lg:col-span-8 min-w-0 w-full space-y-6">
        {/* Article Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text tracking-tight leading-snug">
          {post.title}
        </h1>

        {/* Date & Categories */}
        <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDate(post.publishedAt, locale)}
            </time>
          )}

          {assignedCategories.length > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-2 flex-wrap">
                {assignedCategories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/category/${c.slug}`}
                    className="font-medium text-accent hover:underline transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Body Content */}
        <div
          className="prose-blog pt-2"
          dangerouslySetInnerHTML={{
            __html: renderPostContent(post.contentHtml || post.contentMd || "", {
              utmSource:
                site?.domain && !site.domain.includes("localhost")
                  ? site.domain.replace(/^https?:\/\//, "").split(":")[0]
                  : typeof site?.name === "string" && site.name.trim()
                  ? site.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
                  : "myblog",
              utmCampaign: post.slug,
              utmMedium: "article_embed",
            }),
          }}
        />

        {/* Mermaid Diagrams */}
        {mermaidDiagrams.length > 0 && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text pb-2.5 border-b border-border">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Diagrams ({mermaidDiagrams.length})</span>
            </div>
            {mermaidDiagrams.map((chart, idx) => (
              <MermaidRenderer key={idx} chart={chart} />
            ))}
          </div>
        )}

        {/* Bottom Reactions & Tags Bar */}
        <div className="pt-8 border-t border-border/70 flex flex-wrap items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <LikeButton postId={post.id} initialLikes={Math.floor((post.views || 0) / 8)} size="md" />

            {post.views !== undefined && post.views > 0 && (
              <span className="flex items-center gap-1 font-mono text-xs text-text-muted tabular-nums">
                <Eye className="w-3.5 h-3.5" />
                {post.views}
              </span>
            )}
          </div>

          {/* Tags list (🏷️ tag1 tag2) */}
          {assignedTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <TagIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
              {assignedTags.map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Share buttons */}
        <div className="pt-4 flex items-center justify-between border-t border-border/50 text-xs text-text-muted">
          <span>{t("shareArticle")}:</span>
          <ShareButtons url={shareUrl} title={post.title} />
        </div>

        {/* Prev / Next article link */}
        <div className="flex items-center justify-between pt-6 border-t border-border/50 text-xs">
          {prevPost ? (
            <Link
              href={`/entry/${prevPost.slug}`}
              className="hover:text-primary transition-colors inline-flex items-center gap-1 max-w-[45%] truncate"
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">« {t("previousPost")}: {prevPost.title}</span>
            </Link>
          ) : (
            <div />
          )}

          {nextPost && (
            <Link
              href={`/entry/${nextPost.slug}`}
              className="hover:text-primary transition-colors inline-flex items-center gap-1 max-w-[45%] truncate text-right ml-auto"
            >
              <span className="truncate">{t("nextPost")}: {nextPost.title} »</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          )}
        </div>
      </article>

      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site}
          latestPosts={latestPosts}
          categories={allCategories}
          locale={locale}
        />
      </div>
    </div>
  );
}
