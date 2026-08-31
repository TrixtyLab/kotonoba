import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, pages, categories } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { publishScheduledPosts, getPublicPostCondition, getPublicPageCondition } from "@/lib/db/scheduled";
import { LOCALES } from "@/i18n/routing";
import { getSiteForHost, getActiveSite, getCanonicalBaseUrl } from "@/lib/tenant";

/**
 * Generates dynamic XML sitemaps with multi-language hreflang alternates, change frequencies, and priority weights.
 *
 * @returns Array of sitemap entries with URLs and timestamps.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (await getSiteForHost()) || (await getActiveSite());
  const baseUrl = await getCanonicalBaseUrl(site);

  const db = getDb();
  if (site) {
    await publishScheduledPosts(site.id);
  }

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
          updatedAt: pages.updatedAt,
        })
        .from(pages)
        .where(and(eq(pages.siteId, site.id), getPublicPageCondition()))
        .orderBy(desc(pages.updatedAt))
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
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, l === "en" ? baseUrl : `${baseUrl}/${l}`])
        ),
      },
    },
    ...allCategories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [
            l,
            l === "en" ? `${baseUrl}/category/${c.slug}` : `${baseUrl}/${l}/category/${c.slug}`,
          ])
        ),
      },
    })),
    ...publishedPages.map((p) => ({
      url: `${baseUrl}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [
            l,
            l === "en" ? `${baseUrl}/p/${p.slug}` : `${baseUrl}/${l}/p/${p.slug}`,
          ])
        ),
      },
    })),
    ...publishedPosts.map((p) => {
      const isDefaultLocale = !p.locale || p.locale === "en";
      const postUrl = isDefaultLocale ? `${baseUrl}/entry/${p.slug}` : `${baseUrl}/${p.locale}/entry/${p.slug}`;
      return {
        url: postUrl,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [
              l,
              l === "en" ? `${baseUrl}/entry/${p.slug}` : `${baseUrl}/${l}/entry/${p.slug}`,
            ])
          ),
        },
      };
    }),
  ];

  return entries;
}
