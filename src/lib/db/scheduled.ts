import { getDb } from "@/lib/db";
import { posts, pages } from "@/lib/db/schema";
import { eq, and, lte, or, sql } from "drizzle-orm";

/**
 * Checks for any scheduled posts or pages whose configured publication date/time
 * has arrived (publishedAt <= now) and transitions their status to 'published'.
 *
 * @param {string} [siteId] - Optional site identifier filter for tenant-scoped publishing.
 * @returns {Promise<{ publishedPostsCount: number; publishedPagesCount: number }>} Count of newly published posts and pages.
 */
export async function publishScheduledPosts(siteId?: string): Promise<{
  publishedPostsCount: number;
  publishedPagesCount: number;
}> {
  try {
    const db = getDb();
    const now = new Date();

    const postCondition = and(
      siteId ? eq(posts.siteId, siteId) : undefined,
      eq(posts.status, "scheduled"),
      lte(posts.publishedAt, now)
    );

    const pendingPosts = db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(postCondition)
      .all();

    if (pendingPosts.length > 0) {
      for (const p of pendingPosts) {
        db.update(posts)
          .set({
            status: "published",
            updatedAt: now,
          })
          .where(eq(posts.id, p.id))
          .run();
      }
    }

    const pageCondition = and(
      siteId ? eq(pages.siteId, siteId) : undefined,
      eq(pages.status, "scheduled"),
      lte(pages.publishedAt, now)
    );

    const pendingPages = db
      .select({ id: pages.id })
      .from(pages)
      .where(pageCondition)
      .all();

    if (pendingPages.length > 0) {
      for (const p of pendingPages) {
        db.update(pages)
          .set({
            status: "published",
            updatedAt: now,
          })
          .where(eq(pages.id, p.id))
          .run();
      }
    }

    return {
      publishedPostsCount: pendingPosts.length,
      publishedPagesCount: pendingPages.length,
    };
  } catch (err) {
    console.error("[scheduled] Error publishing scheduled content:", err);
    return { publishedPostsCount: 0, publishedPagesCount: 0 };
  }
}

/**
 * Builds a composite SQL where condition for querying publicly visible articles
 * (either already 'published' or 'scheduled' with publishedAt <= now).
 *
 * @param {Date} [referenceDate] - Optional reference timestamp (defaults to current Date).
 * @returns {import("drizzle-orm").SQL} Combined Drizzle SQL clause.
 */
export function getPublicPostCondition(referenceDate = new Date()) {
  return or(
    eq(posts.status, "published"),
    and(eq(posts.status, "scheduled"), lte(posts.publishedAt, referenceDate))
  );
}

/**
 * Builds a composite SQL where condition for querying publicly visible static custom pages
 * (either already 'published' or 'scheduled' with publishedAt <= now).
 *
 * @param {Date} [referenceDate] - Optional reference timestamp (defaults to current Date).
 * @returns {import("drizzle-orm").SQL} Combined Drizzle SQL clause.
 */
export function getPublicPageCondition(referenceDate = new Date()) {
  return or(
    eq(pages.status, "published"),
    and(eq(pages.status, "scheduled"), lte(pages.publishedAt, referenceDate))
  );
}
