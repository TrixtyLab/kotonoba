import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, categories, tags, users, postCategories, postTags } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/blog/PostCard";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { LinePagination } from "@/components/blog/LinePagination";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Generates SEO metadata tags for the blog homepage.
 *
 * @param props - Object containing route params with active locale.
 * @returns Metadata object with site title and favicon links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const site = await getActiveSite();
  const siteName = site ? getLocalizedText(site.name, locale) : "Kotonoba";
  const siteDesc = site ? getLocalizedText(site.description, locale) || getLocalizedText(site.subtitle, locale) : "Kotonoba CMS";

  return {
    title: siteName,
    description: siteDesc,
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Main public blog homepage presenting a chronological article feed, pagination controls, and right creator profile sidebar.
 *
 * @param props - Object containing route params Promise.
 * @returns React JSX blog homepage element.
 */
export default async function BlogHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  const t = await getTranslations({ locale, namespace: "blog" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  if (!site) {
    return (
      <div className="text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold text-text">No active site configured</h1>
        <p className="text-sm text-text-muted">Please visit the setup wizard or admin panel.</p>
      </div>
    );
  }

  const db = getDb();

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
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.pinned), desc(posts.publishedAt))
    .all();

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();

  // Attach categories and tags to each post
  const allPosts = rawPosts.map((p) => {
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

  const totalPages = Math.max(1, Math.ceil(allPosts.length / 5));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
      {/* Left Column: Post Timeline Stream */}
      <div className="lg:col-span-8 space-y-12">
        {allPosts.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-text-muted/30 mx-auto" />
            <p className="text-sm text-text-muted">{t("noPosts")}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {allPosts.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        )}

        <LinePagination currentPage={1} totalPages={totalPages} baseUrl="/" />
      </div>

      <div className="lg:col-span-4 lg:sticky lg:top-8">
        <LineSidebar
          site={site}
          latestPosts={allPosts.slice(0, 5)}
          categories={allCategories}
          locale={locale}
        />
      </div>
    </div>
  );
}
