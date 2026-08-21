import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, pages, categories, sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { LOCALES } from "@/i18n/routing";

/**
 * Generates dynamic XML sitemaps with multi-language hreflang alternates, change frequencies, and priority weights.
 *
 * @returns Array of sitemap entries with URLs and timestamps.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const primarySite = db.select().from(sites).limit(1).get();
  const baseUrl = primarySite ? `https://${primarySite.domain}` : (process.env.SITE_URL || "http://localhost:3000");

  const publishedPosts = db
    .select({
      slug: posts.slug,
      locale: posts.locale,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(5000)
    .all();

  const publishedPages = db
    .select({
      slug: pages.slug,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(eq(pages.status, "published"))
    .orderBy(desc(pages.updatedAt))
    .limit(1000)
    .all();

  const allCategories = db.select({ slug: categories.slug }).from(categories).all();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${baseUrl}/${l}`])),
      },
    },
    ...allCategories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...publishedPages.map((p) => ({
      url: `${baseUrl}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...publishedPosts.map((p) => ({
      url: `${baseUrl}/entry/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  return entries;
}
