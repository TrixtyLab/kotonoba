import { getDb } from "@/lib/db";
import { posts, pages } from "@/lib/db/schema";
import { eq, and, lte, or } from "drizzle-orm";
import {
  enqueuePostNotifications,
  processPendingOutboxNotifications,
} from "@/lib/notifications/outbox";

/**
 * Transitions scheduled posts and pages whose configured `publishedAt` has elapsed (`<= now`)
 * to `'published'`, enqueues outbox notifications transactionally, and processes pending retries.
 *
 * Designed to run cleanly inside `/api/cron/publish` or manual administrative triggers rather
 * than mutating database state inside public SSR GET page renders.
 *
 * @param {string} [siteId] - Optional site identifier filter for tenant-scoped publishing.
 * @returns Summary counters of newly published posts/pages and dispatched outbox notifications.
 */
export async function publishScheduledPosts(siteId?: string): Promise<{
  publishedPostsCount: number;
  publishedPagesCount: number;
  notificationsSent: number;
  notificationsFailed: number;
}> {
  try {
    const db = getDb();
    const now = new Date();

    const { publishedPostsCount, publishedPagesCount } = db.transaction((tx) => {
      const postCondition = and(
        siteId ? eq(posts.siteId, siteId) : undefined,
        eq(posts.status, "scheduled"),
        lte(posts.publishedAt, now)
      );

      const pendingPosts = tx
        .select({ id: posts.id, siteId: posts.siteId })
        .from(posts)
        .where(postCondition)
        .all();

      for (const p of pendingPosts) {
        tx.update(posts)
          .set({ status: "published", updatedAt: now })
          .where(eq(posts.id, p.id))
          .run();
      }

      const pageCondition = and(
        siteId ? eq(pages.siteId, siteId) : undefined,
        eq(pages.status, "scheduled"),
        lte(pages.publishedAt, now)
      );

      const pendingPages = tx
        .select({ id: pages.id })
        .from(pages)
        .where(pageCondition)
        .all();

      for (const pg of pendingPages) {
        tx.update(pages)
          .set({ status: "published", updatedAt: now })
          .where(eq(pages.id, pg.id))
          .run();
      }

      return {
        publishedPostsCount: pendingPosts.length,
        publishedPagesCount: pendingPages.length,
      };
    });

    if (publishedPostsCount > 0) {
      const dueRecently = db
        .select({ id: posts.id, siteId: posts.siteId })
        .from(posts)
        .where(
          and(
            siteId ? eq(posts.siteId, siteId) : undefined,
            eq(posts.status, "published"),
            eq(posts.updatedAt, now)
          )
        )
        .all();

      for (const post of dueRecently) {
        enqueuePostNotifications(post.siteId, post.id);
      }
    }

    const outboxResult = await processPendingOutboxNotifications(siteId, 50);

    return {
      publishedPostsCount,
      publishedPagesCount,
      notificationsSent: outboxResult.sent,
      notificationsFailed: outboxResult.failed,
    };
  } catch (err) {
    console.error("[scheduled] Error publishing scheduled content:", err);
    return {
      publishedPostsCount: 0,
      publishedPagesCount: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
    };
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
