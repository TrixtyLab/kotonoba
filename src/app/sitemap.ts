import type { MetadataRoute } from "next";
import { buildSiteSitemapEntries } from "@/lib/feeds/build";

export const dynamic = "force-dynamic";

/**
 * Generates dynamic XML sitemaps using accurate locale-specific alternates for monolingual
 * articles/pages and configured site languages for root, archive, category, and tag routes.
 *
 * @returns Array of sitemap entries with URLs and timestamps.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSiteSitemapEntries();
}
