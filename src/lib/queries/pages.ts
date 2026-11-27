import { getDb } from "@/lib/db";
import { pages, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getPublicPageCondition } from "@/lib/db/scheduled";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";

/** Cached public custom page payload joined with author display name. */
export interface PublicSinglePageRecord {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  contentMd: string | null;
  contentHtml: string | null;
  contentFormat: "html" | "markdown" | null;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
}

/**
 * Fetches a single published static custom page behind per-tenant `unstable_cache`
 * keyed by `(siteId, host, locale, slug)`.
 */
export async function getCachedPublicPageBySlug(
  siteId: string,
  slug: string,
  locale = "en",
  host = "default"
): Promise<PublicSinglePageRecord | null> {
  const row = await runWithTenantCache(
    async (): Promise<PublicSinglePageRecord | null> => {
      const db = getDb();
      const page = db
        .select({
          id: pages.id,
          title: pages.title,
          slug: pages.slug,
          content: pages.content,
          contentMd: pages.contentMd,
          contentHtml: pages.contentHtml,
          contentFormat: pages.contentFormat,
          excerpt: pages.excerpt,
          coverImage: pages.coverImage,
          publishedAt: pages.publishedAt,
          createdAt: pages.createdAt,
          authorName: users.displayName,
        })
        .from(pages)
        .leftJoin(users, eq(pages.authorId, users.id))
        .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug), getPublicPageCondition()))
        .get();

      return page || null;
    },
    ["public-page-by-slug", siteId, host, locale, slug],
    {
      tags: [sitePostsCacheTag(siteId)],
      revalidate: 60,
    }
  );

  if (!row) return null;
  return {
    ...row,
    publishedAt: row.publishedAt
      ? row.publishedAt instanceof Date
        ? row.publishedAt
        : new Date(row.publishedAt)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}
