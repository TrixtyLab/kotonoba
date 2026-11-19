import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, pages, categories } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPublicPostCondition, getPublicPageCondition } from "@/lib/db/scheduled";
import { LOCALES, normalizeLocale, type Locale } from "@/i18n/locales";
import { getPublicSite, getCanonicalBaseUrl } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function resolveSiteEnabledLocales(rawSupported?: string | null, fallbackLocale?: string | null): Locale[] {
  const defaultLoc = normalizeLocale(fallbackLocale);
  if (rawSupported) {
    try {
      const parsed = JSON.parse(rawSupported);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((loc): loc is Locale =>
          (LOCALES as readonly string[]).includes(loc)
        );
        if (clean.length > 0) return Array.from(new Set(clean));
      }
    } catch {}
  }
  return [defaultLoc];
}

/**
 * Generates dynamic XML sitemaps using accurate locale-specific alternates for monolingual
 * articles/pages and configured site languages for root and category archives.
 *
 * @returns Array of sitemap entries with URLs and timestamps.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getPublicSite();
  const baseUrl = await getCanonicalBaseUrl(site);
  const siteLocales = resolveSiteEnabledLocales(site?.supportedLocales, site?.locale);

  const db = getDb();

  const publishedPosts = site
    ? db
        .select({
          slug: posts.slug,
          locale: posts.locale,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
        .orderBy(desc(posts.publishedAt))
        .limit(5000)
        .all()
    : [];

  const publishedPages = site
    ? db
        .select({
          slug: pages.slug,
          locale: pages.locale,
          updatedAt: pages.updatedAt,
        })
        .from(pages)
        .where(and(eq(pages.siteId, site.id), getPublicPageCondition()))
        .orderBy(desc(pages.publishedAt))
        .limit(1000)
        .all()
    : [];

  const allCategories = site
    ? db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.siteId, site.id))
        .all()
    : [];

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      ...(siteLocales.length > 1
        ? {
            alternates: {
              languages: Object.fromEntries(
                siteLocales.map((l) => [l, l === "en" ? baseUrl : `${baseUrl}/${l}`])
              ),
            },
          }
        : {}),
    },
    ...allCategories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      ...(siteLocales.length > 1
        ? {
            alternates: {
              languages: Object.fromEntries(
                siteLocales.map((l) => [
                  l,
                  l === "en" ? `${baseUrl}/category/${c.slug}` : `${baseUrl}/${l}/category/${c.slug}`,
                ])
              ),
            },
          }
        : {}),
    })),
    ...publishedPages.map((p) => {
      const pageLocale = normalizeLocale(p.locale);
      const pageUrl = pageLocale === "en" ? `${baseUrl}/p/${p.slug}` : `${baseUrl}/${pageLocale}/p/${p.slug}`;
      return {
        url: pageUrl,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        alternates: {
          languages: { [pageLocale]: pageUrl },
        },
      };
    }),
    ...publishedPosts.map((p) => {
      const postLocale = normalizeLocale(p.locale);
      const postUrl = postLocale === "en" ? `${baseUrl}/entry/${p.slug}` : `${baseUrl}/${postLocale}/entry/${p.slug}`;
      return {
        url: postUrl,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        alternates: {
          languages: { [postLocale]: postUrl },
        },
      };
    }),
  ];

  return entries;
}
