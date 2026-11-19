import { getPublicSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getLatestPublicPostsSummary,
  getPaginatedPublicPosts,
  parsePageNumber,
} from "@/lib/queries/public-posts";
import { PostCard } from "@/components/blog/PostCard";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { LinePagination } from "@/components/blog/LinePagination";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { getSidebarBanners } from "@/lib/banners";
import { getDefaultSiteUrl } from "@/lib/config/env";

/**
 * Generates SEO metadata tags for the blog homepage.
 *
 * @param props - Object containing route params with active locale.
 * @returns Metadata object with site title, OpenGraph, Twitter cards, and favicon links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const site = await getPublicSite();
  const siteName = site ? getLocalizedText(site.name, locale) : "Kotonoba";
  const siteDesc = site ? getLocalizedText(site.description, locale) || getLocalizedText(site.subtitle, locale) : "Kotonoba CMS";
  const baseUrl = site?.domain ? `https://${site.domain}` : getDefaultSiteUrl();
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}`;
  const socialImageUrl = site ? resolveAbsoluteUrl(site.logoUrl || site.faviconUrl, baseUrl) : undefined;

  return {
    metadataBase: new URL(baseUrl),
    title: siteName,
    description: siteDesc,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: siteName,
      description: siteDesc,
      url: canonicalUrl,
      siteName: siteName,
      type: "website",
      images: socialImageUrl ? [{ url: socialImageUrl, alt: siteName }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: siteDesc,
      images: socialImageUrl ? [socialImageUrl] : undefined,
    },
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

  if (!site) {
    return (
      <div className="text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold text-text">{t("noActiveSite")}</h1>
        <p className="text-sm text-text-muted">{t("noActiveSiteHint")}</p>
      </div>
    );
  }

  const db = getDb();
  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();
  const paginated = getPaginatedPublicPosts({
    siteId: site.id,
    page: requestedPage,
    pageSize: 5,
  });
  const latestPosts = getLatestPublicPostsSummary(site.id, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Post Timeline Stream */}
      <div className="lg:col-span-8 min-w-0 w-full space-y-10">
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

        <LinePagination currentPage={paginated.currentPage} totalPages={paginated.totalPages} baseUrl="/" />
      </div>

      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site}
          latestPosts={latestPosts}
          categories={allCategories}
          sidebarBanners={await getSidebarBanners(site.id)}
          locale={locale}
        />
      </div>
    </div>
  );
}
