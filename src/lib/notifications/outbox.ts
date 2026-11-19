import { getDb } from "@/lib/db";
import { notificationOutbox, posts, postTags, settings } from "@/lib/db/schema";
import { and, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { generateId } from "@/lib/utils/slug";
import { sendDiscordPostNotification } from "@/lib/discord";
import { sendBlueskyPostNotification } from "@/lib/bluesky";

const MAX_ATTEMPTS = 5;

function getSiteIntegrationFlags(siteId: string): { discord: boolean; bluesky: boolean } {
  const db = getDb();
  const rows = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.siteId, siteId), inArray(settings.key, ["discord_notifications_enabled", "bluesky_enabled"])))
    .all();

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    discord: map.get("discord_notifications_enabled") === "true",
    bluesky: map.get("bluesky_enabled") === "true",
  };
}

/**
 * Enqueues idempotent notification outbox jobs for newly published posts (deduplicated per
 * `(postId, channel)`) without duplicating sends across manual publish or cron runs.
 *
 * @param siteId - Owning site identifier.
 * @param postId - Published post identifier.
 */
export function enqueuePostNotifications(siteId: string, postId: string): void {
  const db = getDb();
  const enabled = getSiteIntegrationFlags(siteId);
  const now = new Date();

  const channels: Array<"discord" | "bluesky"> = [];
  if (enabled.discord) channels.push("discord");
  if (enabled.bluesky) channels.push("bluesky");

  for (const channel of channels) {
    db.insert(notificationOutbox)
      .values({
        id: generateId(),
        siteId,
        postId,
        channel,
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
  }
}

/**
 * Processes due pending notification outbox deliveries with idempotent deduplication
 * and exponential retry backoff up to 5 attempts.
 *
 * @param siteId - Optional site filter.
 * @param limit - Maximum jobs processed per invocation.
 * @returns Summary counters of sent and retried/failed notifications.
 */
export async function processPendingOutboxNotifications(
  siteId?: string,
  limit = 50
): Promise<{ sent: number; failed: number }> {
  const db = getDb();
  const now = new Date();

  const dueJobs = db
    .select()
    .from(notificationOutbox)
    .where(
      and(
        siteId ? eq(notificationOutbox.siteId, siteId) : undefined,
        eq(notificationOutbox.status, "pending"),
        lt(notificationOutbox.attempts, MAX_ATTEMPTS),
        or(isNull(notificationOutbox.nextAttemptAt), lte(notificationOutbox.nextAttemptAt, now))
      )
    )
    .limit(limit)
    .all();

  let sent = 0;
  let failed = 0;

  for (const job of dueJobs) {
    const post = db
      .select()
      .from(posts)
      .where(and(eq(posts.id, job.postId), eq(posts.siteId, job.siteId)))
      .get();

    if (!post || post.status !== "published") {
      db.update(notificationOutbox)
        .set({ status: "failed", lastError: "Post no longer published", attempts: job.attempts + 1 })
        .where(eq(notificationOutbox.id, job.id))
        .run();
      failed++;
      continue;
    }

    const tagRows = db
      .select({ tagId: postTags.tagId })
      .from(postTags)
      .where(eq(postTags.postId, post.id))
      .all();
    const tagIds = tagRows.map((r) => r.tagId);

    let ok = false;
    let errorMessage = "";
    try {
      if (job.channel === "discord") {
        ok = await sendDiscordPostNotification(job.siteId, {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          coverImage: post.coverImage,
          publishedAt: post.publishedAt,
          locale: post.locale,
          shortUrl: post.shortUrl,
        });
      } else if (job.channel === "bluesky") {
        ok = await sendBlueskyPostNotification(job.siteId, {
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          coverImage: post.coverImage,
          publishedAt: post.publishedAt,
          locale: post.locale,
          shortUrl: post.shortUrl,
          tagIds,
        });
      }
      if (!ok) errorMessage = "Remote delivery returned false";
    } catch (err) {
      ok = false;
      errorMessage = err instanceof Error ? err.message : "Delivery error";
    }

    if (ok) {
      db.update(notificationOutbox)
        .set({
          status: "sent",
          attempts: job.attempts + 1,
          lastError: null,
          sentAt: new Date(),
        })
        .where(eq(notificationOutbox.id, job.id))
        .run();
      sent++;
    } else {
      const nextAttemptCount = job.attempts + 1;
      const exhausted = nextAttemptCount >= MAX_ATTEMPTS;
      const backoffMs = Math.pow(2, nextAttemptCount) * 60_000;
      db.update(notificationOutbox)
        .set({
          status: exhausted ? "failed" : "pending",
          attempts: nextAttemptCount,
          lastError: errorMessage.slice(0, 500),
          nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs),
        })
        .where(eq(notificationOutbox.id, job.id))
        .run();
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Immediately enqueues and attempts dispatch for notifications belonging to a freshly published post.
 *
 * @param siteId - Tenant site identifier.
 * @param postId - Published article identifier.
 */
export async function dispatchPostNotifications(siteId: string, postId: string): Promise<void> {
  enqueuePostNotifications(siteId, postId);
  await processPendingOutboxNotifications(siteId, 10);
}
