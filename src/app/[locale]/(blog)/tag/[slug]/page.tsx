import { getActiveSite, getSiteForHost } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, tags, postTags, postCategories, categories, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/PostCard";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { LinePagination } from "@/components/blog/LinePagination";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/storage";

/**
 * Generates SEO metadata for a tag archive page.
 *
 * @param props - Object containing route params with tag slug and locale.
 * @returns Metadata object with tag title, OpenGraph, Twitter cards, and favicon links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const site = (await getSiteForHost()) || (await getActiveSite());
  const db = getDb();
  const tag = site ? db.select().from(tags).where(and(eq(tags.siteId, site.id), eq(tags.slug, slug))).get() : null;
  const t = await getTranslations({ locale, namespace: "blog" });
  const siteName = site ? getLocalizedText(site.name, locale) : "Blog";
  const baseUrl = site?.domain ? `https://${site.domain}` : (process.env.SITE_URL || "http://localhost:3000");
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/tag/${slug}`;
  const title = tag ? `#${tag.name} — ${siteName}` : t("tag");
  const description = `${t("tag")}: #${tag?.name || slug}`;
  const socialImageUrl = site ? resolveAbsoluteUrl(site.logoUrl || site.faviconUrl, baseUrl) : undefined;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteName,
      type: "website",
      images: socialImageUrl ? [{ url: socialImageUrl, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImageUrl ? [socialImageUrl] : undefined,
    },
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Public tag taxonomy archive page filtering articles associated with a specific tag.
 *
 * @param props - Object containing route params Promise with tag slug.
 * @returns React JSX tag archive view.
 */
export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });

  const db = getDb();
  const tag = db.select().from(tags).where(and(eq(tags.siteId, site.id), eq(tags.slug, slug))).get();
  if (!tag) notFound();

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();

  const rawPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      contentHtml: posts.contentHtml,
      contentMd: posts.contentMd,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt,
      views: posts.views,
      pinned: posts.pinned,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
    })
    .from(postTags)
    .innerJoin(posts, eq(postTags.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(postTags.tagId, tag.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .all();

  const matchingPosts = rawPosts.map((p) => {
    const postCats = db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, p.id))
      .all();

    const pTags = db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, p.id))
      .all();

    return { ...p, categories: postCats, tags: pTags };
  });

  const totalPages = Math.max(1, Math.ceil(matchingPosts.length / 5));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start w-full">
      {/* Left Column: Post Stream */}
      <div className="lg:col-span-8 min-w-0 w-full space-y-10">
        <div className="pb-4 border-b border-border/70">
          <p className="text-xs text-text-muted">{t("tag")}</p>
          <h1 className="text-2xl font-bold text-text mt-1">#{tag.name}</h1>
        </div>

        {matchingPosts.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-text-muted/30 mx-auto" />
            <p className="text-sm text-text-muted">{t("noPosts")}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {matchingPosts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        )}

        <LinePagination currentPage={1} totalPages={totalPages} baseUrl={`/tag/${tag.slug}`} />
      </div>

      {/* Right Column: Profile Sidebar */}
      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site}
          latestPosts={matchingPosts.slice(0, 5)}
          categories={allCategories}
          locale={locale}
        />
      </div>
    </div>
  );
}
