import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, categories, sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { LOCALES } from "@/i18n/routing";

/**
 * Generates dynamic sitemaps with multi-language hreflang alternates and priority scores.
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
    ...publishedPosts.map((p) => ({
      url: `${baseUrl}/entry/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  return entries;
}
