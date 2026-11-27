import { getDb } from "@/lib/db";
import { categories, posts, settings } from "@/lib/db/schema";
import { getPublicPostCondition } from "@/lib/db/scheduled";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";
import { and, desc, eq, inArray } from "drizzle-orm";

/** Cached SEO & crawler visibility settings for a tenant site. */
export interface SiteSeoSettingsSnapshot {
  blockAiCrawlers: boolean;
  llmsTxtEnabled: boolean;
  llmsTxtCustom: string;
}

/**
 * Fetches tenant SEO/AI crawler flags (`block_ai_crawlers`, `llms_txt_enabled`,
 * `llms_txt_custom`) behind per-tenant `unstable_cache`.
 */
export async function getCachedSiteSeoSettings(
  siteId: string,
  host = "default"
): Promise<SiteSeoSettingsSnapshot> {
  return runWithTenantCache(
    async () => {
      const db = getDb();
      const rows = db
        .select({ key: settings.key, value: settings.value })
        .from(settings)
        .where(
          and(
            eq(settings.siteId, siteId),
            inArray(settings.key, ["block_ai_crawlers", "llms_txt_enabled", "llms_txt_custom"])
          )
        )
        .all();

      const map = new Map(rows.map((r) => [r.key, r.value]));
      return {
        blockAiCrawlers: map.get("block_ai_crawlers") === "true",
        llmsTxtEnabled: map.get("llms_txt_enabled") === "true",
        llmsTxtCustom: (map.get("llms_txt_custom") || "").trim(),
      };
    },
    ["site-seo-settings", siteId, host],
    { tags: [sitePostsCacheTag(siteId)], revalidate: 60 }
  );
}

/** Cached article summary and category directory consumed by `/llms.txt`. */
export async function getCachedLlmsSummaryData(siteId: string, host = "default") {
  return runWithTenantCache(
    async () => {
      const db = getDb();
      const topPosts = db
        .select({
          title: posts.title,
          slug: posts.slug,
          locale: posts.locale,
          excerpt: posts.excerpt,
        })
        .from(posts)
        .where(and(eq(posts.siteId, siteId), getPublicPostCondition()))
        .orderBy(desc(posts.views), desc(posts.publishedAt))
        .limit(30)
        .all();

      const allCategories = db
        .select({ name: categories.name, slug: categories.slug })
        .from(categories)
        .where(eq(categories.siteId, siteId))
        .all();

      return { topPosts, allCategories };
    },
    ["llms-summary-data", siteId, host],
    { tags: [sitePostsCacheTag(siteId)], revalidate: 60 }
  );
}

/** Cached full-text article index consumed by `/llms-full.txt`. */
export async function getCachedLlmsFullPosts(siteId: string, host = "default") {
  const rows = await runWithTenantCache(
    async () => {
      const db = getDb();
      return db
        .select({
          title: posts.title,
          slug: posts.slug,
          locale: posts.locale,
          publishedAt: posts.publishedAt,
          excerpt: posts.excerpt,
          content: posts.content,
          contentMd: posts.contentMd,
          contentHtml: posts.contentHtml,
          contentFormat: posts.contentFormat,
        })
        .from(posts)
        .where(and(eq(posts.siteId, siteId), getPublicPostCondition()))
        .orderBy(desc(posts.publishedAt))
        .limit(20)
        .all();
    },
    ["llms-full-posts", siteId, host],
    { tags: [sitePostsCacheTag(siteId)], revalidate: 60 }
  );

  return rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt
      ? row.publishedAt instanceof Date
        ? row.publishedAt
        : new Date(row.publishedAt)
      : null,
  }));
}
