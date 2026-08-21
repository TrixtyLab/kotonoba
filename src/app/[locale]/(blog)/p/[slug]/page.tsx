import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { pages, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { renderPostContent } from "@/lib/utils/markdown";
import { getLocalizedText } from "@/lib/utils/localization";
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
  const site = await getActiveSite();
  if (!site) return { title: "Page Not Found" };

  const db = getDb();
  const page = db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, site.id), eq(pages.slug, slug), eq(pages.status, "published")))
    .get();

  if (!page) return { title: "Page Not Found" };

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}/p/${page.slug}`;
  const siteName = getLocalizedText(site.name, locale);

  return {
    title: `${page.title} — ${siteName}`,
    description: page.excerpt || `${page.title} - ${siteName}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.excerpt || undefined,
      url: canonicalUrl,
      type: "article",
      publishedTime: page.publishedAt?.toISOString(),
      images: page.coverImage ? [{ url: page.coverImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.excerpt || undefined,
      images: page.coverImage ? [page.coverImage] : undefined,
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

  // Increment view count asynchronously
  try {
    const rawViews = db.select({ views: pages.views }).from(pages).where(eq(pages.id, page.id)).get();
    const currentViews = rawViews ? rawViews.views : 0;
    db.update(pages).set({ views: currentViews + 1 }).where(eq(pages.id, page.id)).run();
  } catch {}

  const postContent = page.contentMd || page.contentHtml || "";
  const renderedHtml = renderPostContent(postContent, {
    utmSource:
      site?.domain && !site.domain.includes("localhost")
        ? site.domain.replace(/^https?:\/\//, "").split(":")[0]
        : typeof site?.name === "string" && site.name.trim()
        ? site.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
        : "myblog",
    utmCampaign: page.slug,
    utmMedium: "page_embed",
  });

  const pageUrl = `https://${site.domain}/p/${page.slug}`;

  return (
    <article className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-fade-in">
      {/* Header */}
      <header className="mb-8 space-y-4 text-center sm:text-left">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-text tracking-tight leading-tight">
          {page.title}
        </h1>

        {page.excerpt && (
          <p className="text-sm sm:text-base text-text-muted leading-relaxed font-medium">
            {page.excerpt}
          </p>
        )}
      </header>

      {/* Cover Image */}
      {page.coverImage && (
        <div className="mb-8 rounded-2xl overflow-hidden border border-border shadow-sm aspect-video max-h-[420px] bg-surface-hover/30">
          <img
            src={page.coverImage}
            alt={page.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div
        className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-text leading-relaxed font-sans"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* Bottom Share Bar */}
      <footer className="mt-12 pt-6 border-t border-border flex items-center justify-between flex-wrap gap-4">
        <span className="text-xs text-text-muted font-medium">
          {t("sharePage")}
        </span>
        <ShareButtons title={page.title} url={pageUrl} />
      </footer>
    </article>
  );
}
