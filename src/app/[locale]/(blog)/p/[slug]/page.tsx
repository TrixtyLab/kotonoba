import { getActiveSite, getSiteForHost } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { pages, posts, categories, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { renderPostContent } from "@/lib/utils/markdown";
import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/storage";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

/**
 * Generates OpenGraph, Twitter, and canonical SEO metadata tags for a published custom page.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ slug: string; locale: string }>} props.params - Promise resolving to route parameters with page slug and active locale code.
 * @returns {Promise<Metadata>} Metadata object configured for search engines and social cards.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const site = (await getSiteForHost()) || (await getActiveSite());
  if (!site) return { title: "Page Not Found" };

  const db = getDb();
  const page = db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, site.id), eq(pages.slug, slug), eq(pages.status, "published")))
    .get();

  if (!page) return { title: "Page Not Found" };

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/p/${page.slug}`;
  const siteName = getLocalizedText(site.name, locale);

  const coverImageUrl = resolveAbsoluteUrl(page.coverImage, baseUrl);
  const fallbackImageUrl = resolveAbsoluteUrl(site.logoUrl || site.faviconUrl, baseUrl);
  const socialImageUrl = coverImageUrl || fallbackImageUrl;

  return {
    metadataBase: new URL(baseUrl),
    title: `${page.title} — ${siteName}`,
    description: page.excerpt || `${page.title} - ${siteName}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.excerpt || undefined,
      url: canonicalUrl,
      siteName: siteName,
      type: "article",
      publishedTime: page.publishedAt?.toISOString(),
      images: socialImageUrl
        ? [
            {
              url: socialImageUrl,
              alt: page.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.excerpt || undefined,
      images: socialImageUrl ? [socialImageUrl] : undefined,
    },
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Public custom page reading view rendering formatted markdown HTML and social share buttons.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ slug: string; locale: string }>} props.params - Promise resolving to route parameters with page slug and active locale.
 * @returns {Promise<React.JSX.Element>} React JSX full custom page view.
 */
export default async function CustomPageEntry({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });

  const db = getDb();
  const page = db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      contentMd: pages.contentMd,
      contentHtml: pages.contentHtml,
      excerpt: pages.excerpt,
      coverImage: pages.coverImage,
      publishedAt: pages.publishedAt,
      createdAt: pages.createdAt,
      authorName: users.displayName,
    })
    .from(pages)
    .leftJoin(users, eq(pages.authorId, users.id))
    .where(and(eq(pages.siteId, site.id), eq(pages.slug, slug), eq(pages.status, "published")))
    .get();

  if (!page) notFound();

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();
  const latestPosts = db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .limit(5)
    .all();

  const postContent = page.contentMd || page.contentHtml || "";
  const renderedHtml = renderPostContent(postContent, {
    utmSource:
      site?.domain && !site.domain.includes("localhost")
        ? site.domain.replace(/^https?:\/\//, "").split(":")[0]
        : typeof site?.name === "string" && site.name.trim()
        ? site.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
        : "myblog",
    utmCampaign: page.slug,
    utmMedium: "page_embed",
  });

  const pageUrl = `https://${site.domain}/p/${page.slug}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start w-full">
      {/* Left Column: Page Content */}
      <article className="lg:col-span-8 min-w-0 w-full space-y-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text tracking-tight leading-snug">
          {page.title}
        </h1>

        {page.excerpt && (
          <p className="text-sm text-text-muted leading-relaxed font-medium">
            {page.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose-blog pt-2"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* Bottom Share Bar */}
        <div className="pt-4 flex items-center justify-between border-t border-border/50 text-xs text-text-muted">
          <span>{t("sharePage")}:</span>
          <ShareButtons title={page.title} url={pageUrl} />
        </div>
      </article>

      {/* Right Column: Profile Sidebar */}
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
