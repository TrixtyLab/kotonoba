import { getPublicSite, getRequestNormalizedHost } from "@/lib/tenant";
import { formatDate } from "@/lib/utils/date";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { LinePagination } from "@/components/blog/LinePagination";
import { Link } from "@/i18n/routing";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { getCachedSidebarBanners } from "@/lib/banners";
import { getDefaultSiteUrl } from "@/lib/config/env";
import { ARCHIVE_PAGE_SIZE, DEFAULT_PUBLIC_PAGE_SIZE } from "@/lib/config/constants";
import {
  getCachedLatestPublicPostsSummary,
  getCachedPaginatedArchivePosts,
  parsePageNumber,
  type ArchivePostItem,
} from "@/lib/queries/public-posts";
import { getCachedSiteCategories } from "@/lib/queries/taxonomy";

/**
 * Generates SEO metadata for the chronological blog archive.
 *
 * @param props - Object containing route params with locale.
 * @returns Metadata object with archive title, OpenGraph, Twitter cards, and favicon links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const site = await getPublicSite();
  const t = await getTranslations({ locale, namespace: "blog" });
  const siteName = site ? getLocalizedText(site.name, locale) : "Blog";
  const baseUrl = site?.domain ? `https://${site.domain}` : getDefaultSiteUrl();
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/archive`;
  const title = `${t("archive")} — ${siteName}`;
  const description = t("archive");
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
 * Public monthly archive page displaying server-paginated chronological posts grouped by year.
 *
 * @param props - Object containing route params Promise and `?page=` searchParams Promise.
 * @returns React JSX paginated chronological archive view.
 */
export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPage = parsePageNumber(resolvedSearchParams.page);
  const site = await getPublicSite();
  const t = await getTranslations({ locale, namespace: "blog" });

  const host = await getRequestNormalizedHost();
  const [paginated, allCategories, latestPosts, sidebarBanners] = site
    ? await Promise.all([
        getCachedPaginatedArchivePosts({
          siteId: site.id,
          locale,
          host,
          page: requestedPage,
          pageSize: ARCHIVE_PAGE_SIZE,
        }),
        getCachedSiteCategories(site.id, locale, host),
        getCachedLatestPublicPostsSummary(site.id, DEFAULT_PUBLIC_PAGE_SIZE, locale, host),
        getCachedSidebarBanners(site.id, host),
      ])
    : [
        { items: [] as ArchivePostItem[], totalCount: 0, totalPages: 1, currentPage: 1 },
        [],
        [],
        [],
      ];

  const groupedByYear: Record<number, ArchivePostItem[]> = {};
  for (const post of paginated.items) {
    const year = post.publishedAt
      ? new Date(post.publishedAt).getFullYear()
      : new Date().getFullYear();
    if (!groupedByYear[year]) groupedByYear[year] = [];
    groupedByYear[year].push(post);
  }
  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Chronological Post List */}
      <div className="lg:col-span-8 min-w-0 w-full space-y-10">
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-2xl font-bold text-text">{t("archive")}</h1>
          <p className="text-xs text-text-muted mt-1">{t("totalArticles", { count: paginated.totalCount })}</p>
        </div>

        <div className="space-y-10">
          {years.map((year) => (
            <section key={year} className="space-y-4">
              <h2 className="text-base font-bold text-text pb-2 border-b border-border/40">
                {year}
              </h2>

              <ul className="space-y-3 pl-2">
                {groupedByYear[year].map((post) => (
                  <li key={post.id} className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-sm">
                    <Link
                      href={`/entry/${post.slug}`}
                      className="hover:text-accent transition-colors font-medium line-clamp-1"
                    >
                      {post.title}
                    </Link>
                    {post.publishedAt && (
                      <span className="text-xs text-text-muted shrink-0 font-mono">
                        {formatDate(post.publishedAt, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {years.length === 0 && (
            <div className="py-20 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-text-muted/30 mx-auto" />
              <p className="text-sm text-text-muted">{t("noPosts")}</p>
            </div>
          )}
        </div>

        <LinePagination
          currentPage={paginated.currentPage}
          totalPages={paginated.totalPages}
          baseUrl="/archive"
        />
      </div>

      {/* Right Column: Profile Sidebar */}
      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site || { name: "Blog" }}
          latestPosts={latestPosts}
          categories={allCategories}
          sidebarBanners={sidebarBanners}
          locale={locale}
        />
      </div>
    </div>
  );
}
