import { getDb } from "@/lib/db";
import { posts, postCategories, postTags, users, sites, analytics } from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { type PostInput } from "@/lib/security/validate";
import { isDubConfigured, createDubLink, deleteDubLink } from "@/lib/dub";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { resolveCanonicalContent } from "@/lib/content/canonical";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";
import { recordAuditEvent } from "@/lib/security/audit";
import { taxonomyBelongsToSite } from "@/lib/db/tenant-scope";
import { dispatchPostNotifications } from "@/lib/notifications/outbox";

/**
 * Result payload returned from post creation or update operations.
 */
export type PostMutationResponse =
  | { success: true; postId: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Overview post structure formatted for administration dashboard listings.
 */
export interface AdminPostRecord {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "scheduled" | "archived";
  locale: string;
  views: number;
  pinned: boolean;
  shortUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
}

/**
 * Creates a post record, links tenant-validated categories/tags, dispatches notifications,
 * and provisions optional Dub short links.
 */
export async function createPostService(
  actor: TokenPayload,
  siteId: string,
  data: PostInput
): Promise<{ result: PostMutationResponse; postSlug?: string }> {
  const {
    title,
    slug,
    contentMd,
    contentHtml,
    contentFormat,
    excerpt,
    coverImage,
    status,
    publishedAt,
    locale,
    categoryIds,
    tagIds,
    pinned,
    shortUrl,
    dubLinkId,
  } = data;

  if (!taxonomyBelongsToSite(siteId, categoryIds, tagIds)) {
    return { result: { success: false, error: "Invalid taxonomy selection" } };
  }

  const db = getDb();
  const postId = generateId();
  const postSlug = slug ? generateSlug(slug) : generateSlug(title);

  const duplicateSlug = db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.slug, postSlug)))
    .get();
  if (duplicateSlug) {
    return {
      result: { success: false, errors: { slug: ["An article with this slug already exists in this site."] } },
    };
  }

  const now = new Date();
  let targetPublishedAt: Date | null = null;
  if (status === "published" || status === "scheduled") {
    if (publishedAt) {
      const parsed = new Date(publishedAt);
      targetPublishedAt = !isNaN(parsed.getTime()) ? parsed : now;
    } else {
      targetPublishedAt = now;
    }
  }

  let finalShortUrl = shortUrl ? sanitizeUrl(shortUrl, { allowRelative: false }) : null;
  let finalDubLinkId = dubLinkId || null;

  if (!finalShortUrl && isDubConfigured()) {
    try {
      const site = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, siteId)).get();
      const fullUrl = `${buildSiteBaseUrl(site?.domain || "localhost:3000")}/entry/${postSlug}`;
      const dubResult = await createDubLink({
        url: fullUrl,
        slug: postSlug,
        tags: ["blog", "blog-cms", locale],
        comments: `Article: ${title.slice(0, 50)} (Kotonoba CMS)`,
      });
      if (dubResult) {
        finalShortUrl = dubResult.shortUrl;
        finalDubLinkId = dubResult.id;
      }
    } catch {
      // Non-blocking on external API failure
    }
  }

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat);
  const safeCoverImage = coverImage ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true }) : null;

  db.insert(posts)
    .values({
      id: postId,
      siteId,
      authorId: actor.userId,
      title,
      slug: postSlug,
      contentMd: canonical.contentMd,
      contentHtml: canonical.contentHtml,
      contentFormat: canonical.contentFormat,
      excerpt: excerpt || "",
      coverImage: safeCoverImage,
      status,
      locale,
      publishedAt: targetPublishedAt,
      createdAt: now,
      updatedAt: now,
      views: 0,
      pinned,
      shortUrl: finalShortUrl,
      dubLinkId: finalDubLinkId,
    })
    .run();

  if (categoryIds && categoryIds.length > 0) {
    for (const catId of categoryIds) {
      db.insert(postCategories).values({ postId, categoryId: catId }).run();
    }
  }

  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      db.insert(postTags).values({ postId, tagId }).run();
    }
  }

  if (status === "published") {
    dispatchPostNotifications(siteId, postId).catch(() => {});
  }

  return { result: { success: true, postId }, postSlug };
}

/**
 * Loads basic ownership metadata required before authorizing and updating a post.
 */
export function getExistingPostMeta(postId: string) {
  return getDb()
    .select({
      id: posts.id,
      authorId: posts.authorId,
      siteId: posts.siteId,
      slug: posts.slug,
      publishedAt: posts.publishedAt,
      shortUrl: posts.shortUrl,
      dubLinkId: posts.dubLinkId,
      locale: posts.locale,
      status: posts.status,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();
}

/**
 * Updates an existing blog post, validates tenant taxonomy ownership, syncs categories/tags, and notifies integrations.
 */
export async function updatePostService(
  actor: TokenPayload,
  existing: NonNullable<ReturnType<typeof getExistingPostMeta>>,
  data: PostInput
): Promise<{ result: PostMutationResponse; postSlug?: string }> {
  if (actor.role === "author" && existing.authorId !== actor.userId) {
    return { result: { success: false, error: "You can only edit your own articles." } };
  }

  const {
    title,
    slug,
    contentMd,
    contentHtml,
    contentFormat,
    excerpt,
    coverImage,
    status,
    publishedAt,
    locale,
    categoryIds,
    tagIds,
    pinned,
    shortUrl,
    dubLinkId,
  } = data;

  if (!taxonomyBelongsToSite(existing.siteId, categoryIds, tagIds)) {
    return { result: { success: false, error: "Invalid taxonomy selection" } };
  }

  const db = getDb();
  const postSlug = slug ? generateSlug(slug) : generateSlug(title);
  const duplicateSlug = db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.siteId, existing.siteId), eq(posts.slug, postSlug), ne(posts.id, existing.id)))
    .get();
  if (duplicateSlug) {
    return {
      result: { success: false, errors: { slug: ["An article with this slug already exists in this site."] } },
    };
  }

  const now = new Date();
  let targetPublishedAt: Date | null = null;
  if (status === "published" || status === "scheduled") {
    if (publishedAt) {
      const parsed = new Date(publishedAt);
      targetPublishedAt = !isNaN(parsed.getTime()) ? parsed : existing.publishedAt || now;
    } else {
      targetPublishedAt = existing.publishedAt || now;
    }
  } else if (status === "draft") {
    targetPublishedAt = null;
  } else {
    targetPublishedAt = existing.publishedAt;
  }

  let finalShortUrl =
    shortUrl !== undefined ? (shortUrl ? sanitizeUrl(shortUrl, { allowRelative: false }) : null) : existing.shortUrl;
  let finalDubLinkId = dubLinkId !== undefined ? dubLinkId : existing.dubLinkId;

  if (status === "published" && !finalShortUrl && isDubConfigured()) {
    try {
      const site = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, existing.siteId)).get();
      const fullUrl = `${buildSiteBaseUrl(site?.domain || "localhost:3000")}/entry/${postSlug}`;
      const dubResult = await createDubLink({
        url: fullUrl,
        slug: postSlug,
        tags: ["blog", "blog-cms", locale || existing.locale],
        comments: `Article: ${title.slice(0, 50)} (Kotonoba CMS)`,
      });
      if (dubResult) {
        finalShortUrl = dubResult.shortUrl;
        finalDubLinkId = dubResult.id;
      }
    } catch {
      // Non-blocking on external API failure
    }
  }

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat);
  const safeCoverImage = coverImage ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true }) : null;

  db.update(posts)
    .set({
      title,
      slug: postSlug,
      contentMd: canonical.contentMd,
      contentHtml: canonical.contentHtml,
      contentFormat: canonical.contentFormat,
      excerpt: excerpt || "",
      coverImage: safeCoverImage,
      status,
      locale,
      publishedAt: targetPublishedAt,
      updatedAt: now,
      pinned,
      shortUrl: finalShortUrl,
      dubLinkId: finalDubLinkId,
    })
    .where(eq(posts.id, existing.id))
    .run();

  db.delete(postCategories).where(eq(postCategories.postId, existing.id)).run();
  if (categoryIds && categoryIds.length > 0) {
    for (const catId of categoryIds) {
      db.insert(postCategories).values({ postId: existing.id, categoryId: catId }).run();
    }
  }

  db.delete(postTags).where(eq(postTags.postId, existing.id)).run();
  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      db.insert(postTags).values({ postId: existing.id, tagId }).run();
    }
  }

  const isNewlyPublished = status === "published" && (!existing.publishedAt || existing.status !== "published");
  if (isNewlyPublished) {
    dispatchPostNotifications(existing.siteId, existing.id).catch(() => {});
  }

  return { result: { success: true, postId: existing.id }, postSlug };
}

/**
 * Deletes a post, cleans up Dub.co short link & analytics rows by exact postId, and writes audit log.
 */
export async function deletePostService(actor: TokenPayload, postId: string): Promise<{ deletedSlug?: string }> {
  const db = getDb();
  const existing = db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!existing) return {};

  if (existing.dubLinkId) {
    try {
      await deleteDubLink(existing.dubLinkId);
    } catch {
      // Non-blocking
    }
  }

  db.delete(analytics).where(eq(analytics.postId, postId)).run();
  db.delete(posts).where(eq(posts.id, postId)).run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: existing.siteId,
    action: "post.delete",
    targetType: "post",
    targetId: postId,
    metadata: { slug: existing.slug },
  });

  return { deletedSlug: existing.slug };
}

/** Lists all posts for admin management tables for a specific tenant site. */
export function listAdminPosts(siteId: string): AdminPostRecord[] {
  const db = getDb();
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      locale: posts.locale,
      views: posts.views,
      pinned: posts.pinned,
      shortUrl: posts.shortUrl,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.siteId, siteId))
    .orderBy(desc(posts.createdAt))
    .all() as AdminPostRecord[];
}
