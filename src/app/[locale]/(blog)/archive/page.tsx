import { getActiveSite, getSiteForHost } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, categories, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { publishScheduledPosts, getPublicPostCondition } from "@/lib/db/scheduled";
import { formatDate } from "@/lib/utils/date";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { Link } from "@/i18n/routing";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/storage";
import { getSidebarBanners } from "@/lib/banners";

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
  const site = (await getSiteForHost()) || (await getActiveSite());
  const t = await getTranslations({ locale, namespace: "blog" });
  const siteName = site ? getLocalizedText(site.name, locale) : "Blog";
  const baseUrl = site?.domain ? `https://${site.domain}` : (process.env.SITE_URL || "http://localhost:3000");
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
 * Public monthly archive page displaying grouped historical posts cataloged by year and month.
 *
 * @param props - Object containing route params Promise.
 * @returns React JSX monthly archive view.
 */
export default async function ArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  const db = getDb();
  const t = await getTranslations({ locale, namespace: "blog" });

  if (site) {
    await publishScheduledPosts(site.id);
  }

  const allPosts = site
    ? db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          publishedAt: posts.publishedAt,
          views: posts.views,
        })
        .from(posts)
        .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
        .orderBy(desc(posts.publishedAt))
        .all()
    : [];

  const allCategories = site ? db.select().from(categories).where(eq(categories.siteId, site.id)).all() : [];

  const groupedByYear: Record<string, typeof allPosts> = {};
  for (const post of allPosts) {
    const year = post.publishedAt ? post.publishedAt.getFullYear().toString() : "Other";
    if (!groupedByYear[year]) groupedByYear[year] = [];
    groupedByYear[year].push(post);
  }

  const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Chronological Post List */}
      <div className="lg:col-span-8 min-w-0 w-full space-y-10">
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-2xl font-bold text-text">{t("archive")}</h1>
          <p className="text-xs text-text-muted mt-1">{t("totalArticles", { count: allPosts.length })}</p>
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
      </div>

      {/* Right Column: Profile Sidebar */}
      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site || { name: "Blog" }}
          latestPosts={allPosts.slice(0, 5)}
          categories={allCategories}
          sidebarBanners={site ? await getSidebarBanners(site.id) : []}
          locale={locale}
        />
      </div>
    </div>
  );
}
