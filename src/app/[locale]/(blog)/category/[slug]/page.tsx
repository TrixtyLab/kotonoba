import { getPublicSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getLatestPublicPostsSummary,
  getPaginatedPublicPosts,
  parsePageNumber,
} from "@/lib/queries/public-posts";
import { notFound } from "next/navigation";
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
  const site = await getPublicSite();
  const db = getDb();
  const cat = site ? db.select().from(categories).where(and(eq(categories.siteId, site.id), eq(categories.slug, slug))).get() : null;
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

  const db = getDb();

  const cat = db.select().from(categories).where(and(eq(categories.siteId, site.id), eq(categories.slug, slug))).get();
  if (!cat) notFound();

  const allCategories = db.select().from(categories).where(eq(categories.siteId, site.id)).all();
  const paginated = getPaginatedPublicPosts({
    siteId: site.id,
    categoryId: cat.id,
    page: requestedPage,
    pageSize: 5,
  });
  const latestPosts = getLatestPublicPostsSummary(site.id, 5);

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
          sidebarBanners={await getSidebarBanners(site.id)}
          locale={locale}
        />
      </div>
    </div>
  );
}
