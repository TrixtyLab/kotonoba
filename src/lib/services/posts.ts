import { getDb } from "@/lib/db";
import { posts, postCategories, postTags, users, sites, analytics } from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { type PostInput } from "@/lib/contracts";
import { isDubConfigured, createDubLink, deleteDubLink } from "@/lib/dub";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { resolveCanonicalContent } from "@/lib/content/canonical";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";
import { recordAuditEvent } from "@/lib/security/audit";
import { taxonomyBelongsToSite } from "@/lib/db/tenant-scope";
import { dispatchPostNotifications } from "@/lib/notifications/outbox";
import { POST_STATUS, ROLES, type PostStatus } from "@/lib/config/constants";

/**
 * Result payload returned from post creation or update operations.
 */
export type PostMutationResponse =
  | { success: true; postId: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

function rejectAuthorPinChange(
  actor: TokenPayload,
  pinned: boolean | undefined,
  previousPinned?: boolean
): PostMutationResponse | null {
  if (actor.role !== ROLES.AUTHOR) return null;
  if (previousPinned === undefined) {
    return pinned ? { success: false, error: "Authors cannot pin articles to the homepage." } : null;
  }
  return pinned !== previousPinned
    ? { success: false, error: "Authors cannot change the homepage pin." }
    : null;
}

/**
 * Applies the creation-time authorization and tenant checks shared by the create service.
 *
 * @returns A rejection payload, or `null` when creation may proceed.
 */
function rejectInvalidPostCreation(
  actor: TokenPayload,
  siteId: string,
  pinned: boolean | undefined,
  categoryIds: string[] | undefined,
  tagIds: string[] | undefined
): PostMutationResponse | null {
  const pinError = rejectAuthorPinChange(actor, pinned);
  if (pinError) return pinError;
  return taxonomyBelongsToSite(siteId, categoryIds, tagIds)
    ? null
    : { success: false, error: "Invalid taxonomy selection" };
}

/**
 * Overview post structure formatted for administration dashboard listings.
 */
export interface AdminPostRecord {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  locale: string;
  views: number;
  pinned: boolean;
  shortUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  authorId: string;
  authorName: string | null;
}

function resolveTargetPublishedAt(
  status: string,
  publishedAt: string | Date | null | undefined,
  fallbackDate: Date | null,
  defaultOnPublish: Date
): Date | null {
  if (status === POST_STATUS.DRAFT) return null;
  if (status !== POST_STATUS.PUBLISHED && status !== POST_STATUS.SCHEDULED) return fallbackDate;
  if (!publishedAt) return fallbackDate || defaultOnPublish;
  const parsed = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  return !isNaN(parsed.getTime()) ? parsed : fallbackDate || defaultOnPublish;
}

async function maybeProvisionDubShortLink(options: {
  siteId: string;
  postSlug: string;
  title: string;
  locale: string;
  currentShortUrl: string | null;
  currentDubLinkId: string | null;
}): Promise<{ shortUrl: string | null; dubLinkId: string | null }> {
  if (options.currentShortUrl || !isDubConfigured()) {
    return { shortUrl: options.currentShortUrl, dubLinkId: options.currentDubLinkId };
  }
  try {
    const db = getDb();
    const site = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, options.siteId)).get();
    const fullUrl = `${buildSiteBaseUrl(site?.domain || "localhost:3000")}/entry/${options.postSlug}`;
    const dubResult = await createDubLink({
      url: fullUrl,
      slug: options.postSlug,
      tags: ["blog", "blog-cms", options.locale],
      comments: `Article: ${options.title.slice(0, 50)} (Kotonoba CMS)`,
    });
    if (dubResult) return { shortUrl: dubResult.shortUrl, dubLinkId: dubResult.id };
  } catch {
    // Non-blocking on external API failure
  }
  return { shortUrl: options.currentShortUrl, dubLinkId: options.currentDubLinkId };
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
    content,
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

  const creationError = rejectInvalidPostCreation(actor, siteId, pinned, categoryIds, tagIds);
  if (creationError) return { result: creationError };

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
  const targetPublishedAt = resolveTargetPublishedAt(status, publishedAt, null, now);
  const resolvedDub = await maybeProvisionDubShortLink({
    siteId,
    postSlug,
    title,
    locale,
    currentShortUrl: shortUrl ? sanitizeUrl(shortUrl, { allowRelative: false }) : null,
    currentDubLinkId: dubLinkId || null,
  });
  const finalShortUrl = resolvedDub.shortUrl;
  const finalDubLinkId = resolvedDub.dubLinkId;

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat, content);
  const safeCoverImage = coverImage ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true }) : null;

  db.insert(posts)
    .values({
      id: postId,
      siteId,
      authorId: actor.userId,
      title,
      slug: postSlug,
      content: canonical.content,
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

  if (status === POST_STATUS.PUBLISHED) {
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
      pinned: posts.pinned,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();
}

function syncUpdatedPostTaxonomies(
  postId: string,
  categoryIds?: string[],
  tagIds?: string[]
): void {
  const db = getDb();
  db.delete(postCategories).where(eq(postCategories.postId, postId)).run();
  for (const catId of categoryIds || []) {
    db.insert(postCategories).values({ postId, categoryId: catId }).run();
  }
  db.delete(postTags).where(eq(postTags.postId, postId)).run();
  for (const tagId of tagIds || []) {
    db.insert(postTags).values({ postId, tagId }).run();
  }
}

function buildUpdatedShortLinkInputs(
  shortUrl: string | null | undefined,
  dubLinkId: string | null | undefined,
  existing: NonNullable<ReturnType<typeof getExistingPostMeta>>
) {
  return {
    shortUrl: shortUrl !== undefined ? (shortUrl ? sanitizeUrl(shortUrl, { allowRelative: false }) : null) : existing.shortUrl,
    dubLinkId: dubLinkId !== undefined ? dubLinkId : existing.dubLinkId,
  };
}

/**
 * Updates an existing blog post, validates tenant taxonomy ownership, syncs categories/tags, and notifies integrations.
 */
export async function updatePostService(
  actor: TokenPayload,
  existing: NonNullable<ReturnType<typeof getExistingPostMeta>>,
  data: PostInput
): Promise<{ result: PostMutationResponse; postSlug?: string }> {
  if (actor.role === ROLES.AUTHOR && existing.authorId !== actor.userId) {
    return { result: { success: false, error: "You can only edit your own articles." } };
  }

  const pinError = rejectAuthorPinChange(actor, data.pinned, existing.pinned);
  if (pinError) return { result: pinError };

  const { title, slug, content, contentMd, contentHtml, contentFormat, excerpt, coverImage, status, publishedAt, locale, categoryIds, tagIds, pinned, shortUrl, dubLinkId } = data;
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
    return { result: { success: false, errors: { slug: ["An article with this slug already exists in this site."] } } };
  }

  const now = new Date();
  const targetPublishedAt = resolveTargetPublishedAt(status, publishedAt, existing.publishedAt, now);
  const initialLinks = buildUpdatedShortLinkInputs(shortUrl, dubLinkId, existing);
  const resolvedDub =
    status === POST_STATUS.PUBLISHED
      ? await maybeProvisionDubShortLink({
          siteId: existing.siteId,
          postSlug,
          title,
          locale: locale || existing.locale,
          currentShortUrl: initialLinks.shortUrl,
          currentDubLinkId: initialLinks.dubLinkId,
        })
      : initialLinks;

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat, content);
  const safeCoverImage = coverImage ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true }) : null;

  db.update(posts)
    .set({
      title,
      slug: postSlug,
      content: canonical.content,
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
      shortUrl: resolvedDub.shortUrl,
      dubLinkId: resolvedDub.dubLinkId,
    })
    .where(eq(posts.id, existing.id))
    .run();

  syncUpdatedPostTaxonomies(existing.id, categoryIds, tagIds);

  const isNewlyPublished = status === POST_STATUS.PUBLISHED && (!existing.publishedAt || existing.status !== POST_STATUS.PUBLISHED);
  if (isNewlyPublished) dispatchPostNotifications(existing.siteId, existing.id).catch(() => {});

  return { result: { success: true, postId: existing.id }, postSlug };
}

/**
 * Deletes a post, cleans up Dub.co short link & analytics rows by exact postId, and writes audit log.
 */
export async function deletePostService(
  actor: TokenPayload,
  postId: string
): Promise<{ success: boolean; error?: string; deletedSlug?: string; siteId?: string }> {
  const db = getDb();
  const existing = db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!existing) return { success: false, error: "Article not found" };
  if (actor.role === ROLES.AUTHOR && existing.authorId !== actor.userId) {
    return { success: false, error: "You can only delete your own articles." };
  }

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

  return { success: true, deletedSlug: existing.slug, siteId: existing.siteId };
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
      authorId: posts.authorId,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.siteId, siteId))
    .orderBy(desc(posts.createdAt))
    .all() as AdminPostRecord[];
}
