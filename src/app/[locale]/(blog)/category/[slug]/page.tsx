import { getPublicSite, getRequestNormalizedHost } from "@/lib/tenant";
import {
  getCachedLatestPublicPostsSummary,
  getCachedPaginatedPublicPosts,
  parsePageNumber,
} from "@/lib/queries/public-posts";
import { getCachedCategoryBySlug, getCachedSiteCategories } from "@/lib/queries/taxonomy";
import { DEFAULT_PUBLIC_PAGE_SIZE } from "@/lib/config/constants";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/PostCard";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { LinePagination } from "@/components/blog/LinePagination";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { getCachedSidebarBanners } from "@/lib/banners";
import { getDefaultSiteUrl } from "@/lib/config/env";

/**
 * Generates SEO metadata for a category taxonomy archive page.
 *
 * @param props - Object containing route params with category slug and locale.
 * @returns Metadata object with category title, OpenGraph, Twitter cards, and favicon links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  const cat = site ? await getCachedCategoryBySlug(site.id, slug, locale, host) : null;
  const t = await getTranslations({ locale, namespace: "blog" });
  const siteName = site ? getLocalizedText(site.name, locale) : "Blog";
  const baseUrl = site?.domain ? `https://${site.domain}` : getDefaultSiteUrl();
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/category/${slug}`;
  const title = cat ? `${cat.name} — ${siteName}` : t("category");
  const description = cat?.description || `${t("category")}: ${cat?.name || slug}`;
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
 * Public category archive page filtering and presenting articles categorized under a specific category taxonomy.
 *
 * @param props - Object containing route params Promise with category slug.
 * @returns React JSX category archive view.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPage = parsePageNumber(resolvedSearchParams.page);
  const site = await getPublicSite();
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });
  const host = await getRequestNormalizedHost();

  const cat = await getCachedCategoryBySlug(site.id, slug, locale, host);
  if (!cat) notFound();

  const [allCategories, paginated, latestPosts, sidebarBanners] = await Promise.all([
    getCachedSiteCategories(site.id, locale, host),
    getCachedPaginatedPublicPosts({
      siteId: site.id,
      locale,
      host,
      categoryId: cat.id,
      page: requestedPage,
      pageSize: DEFAULT_PUBLIC_PAGE_SIZE,
    }),
    getCachedLatestPublicPostsSummary(site.id, DEFAULT_PUBLIC_PAGE_SIZE, locale, host),
    getCachedSidebarBanners(site.id, host),
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Post Stream */}
      <div className="lg:col-span-8 min-w-0 w-full space-y-10">
        <div className="pb-4 border-b border-border/40">
          <p className="text-xs text-text-muted">{t("category")}</p>
          <h1 className="text-2xl font-bold text-text mt-1">{cat.name}</h1>
          {cat.description && <p className="text-xs text-text-muted mt-1">{cat.description}</p>}
        </div>

        {paginated.items.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-text-muted/30 mx-auto" />
            <p className="text-sm text-text-muted">{t("noPosts")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {paginated.items.map((post) => (
              <PostCard key={post.id} post={post} locale={locale} />
            ))}
          </div>
        )}

        <LinePagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} baseUrl={`/category/${cat.slug}`} />
      </div>

      {/* Right Column: Profile Sidebar */}
      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site}
          latestPosts={latestPosts}
          categories={allCategories}
          sidebarBanners={sidebarBanners}
          locale={locale}
        />
      </div>
    </div>
  );
}
