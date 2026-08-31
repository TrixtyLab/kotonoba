"use server";

import { getDb } from "@/lib/db";
import { posts, postCategories, postTags, users, sites } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { postSchema, validate, type PostInput } from "@/lib/security/validate";
import { isDubConfigured, createDubLink } from "@/lib/dub";
import { normalizeMediaUrl, normalizeHtmlMediaUrls } from "@/lib/storage";
import { sendDiscordPostNotification } from "@/lib/discord";
import { sendBlueskyPostNotification } from "@/lib/bluesky";
import { revalidatePath } from "next/cache";

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
 * Creates a new blog article associated with the authenticated author and active site.
 * Automatically provisions Dub.co shortened campaign links when configured.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param inputData - Post attributes including title, markdown/html content, taxonomy IDs, and publication status.
 * @returns A Promise resolving to a PostMutationResponse with the created post ID or validation errors.
 * @throws {Error} When the caller lacks an authorized author, editor, or administrator session.
 */
export async function createPost(siteId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const user = await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(postSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const {
    title,
    slug,
    contentMd,
    contentHtml,
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
  } = validation.data;

  const db = getDb();
  const postId = generateId();
  const postSlug = slug ? generateSlug(slug) : generateSlug(title);
  const now = new Date();

  let targetPublishedAt: Date | null = null;
  if (status === "published") {
    targetPublishedAt = publishedAt ? new Date(publishedAt) : now;
  } else if (status === "scheduled") {
    targetPublishedAt = publishedAt ? new Date(publishedAt) : now;
  }

  let finalShortUrl = shortUrl || null;
  let finalDubLinkId = dubLinkId || null;

  if (!finalShortUrl && isDubConfigured()) {
    try {
      const site = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, siteId)).get();
      const siteDomain = site?.domain || "localhost:3000";
      const fullUrl = siteDomain.includes("localhost")
        ? `http://${siteDomain}/entry/${postSlug}`
        : `https://${siteDomain}/entry/${postSlug}`;
      
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

  db.insert(posts)
    .values({
      id: postId,
      siteId,
      authorId: user.userId,
      title,
      slug: postSlug,
      contentMd: normalizeHtmlMediaUrls(contentMd || ""),
      contentHtml: normalizeHtmlMediaUrls(contentHtml || ""),
      excerpt: excerpt || "",
      coverImage: normalizeMediaUrl(coverImage) || null,
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
      db.insert(postCategories)
        .values({ postId, categoryId: catId })
        .run();
    }
  }

  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      db.insert(postTags)
        .values({ postId, tagId })
        .run();
    }
  }

  if (status === "published") {
    const notifPayload = {
      id: postId,
      title,
      slug: postSlug,
      excerpt: excerpt || "",
      coverImage: normalizeMediaUrl(coverImage) || null,
      authorName: user.name || "Author",
      locale,
    };

    sendDiscordPostNotification(siteId, notifPayload).catch(() => {});
    sendBlueskyPostNotification(siteId, notifPayload).catch(() => {});
  }

  revalidatePath("/[locale]/admin/posts", "page");
  revalidatePath(`/[locale]/entry/${postSlug}`, "page");
  revalidatePath("/sitemap.xml", "page");
  revalidatePath("/rss.xml", "page");
  revalidatePath("/feed.json", "page");
  revalidatePath("/atom.xml", "page");

  return { success: true, postId };
}

/**
 * Updates an existing blog post record and synchronizes category and tag associations.
 *
 * @param postId - Unique identifier of the post to update.
 * @param inputData - Updated post attributes.
 * @returns A Promise resolving to a PostMutationResponse indicating success or validation errors.
 * @throws {Error} When the caller lacks an authorized editor or author session.
 */
export async function updatePost(postId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const user = await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(postSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const db = getDb();
  const existing = db
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

  if (!existing) {
    return { success: false, error: "Article not found" };
  }

  if (user.role === "author" && existing.authorId !== user.userId) {
    return { success: false, error: "You can only edit your own articles." };
  }

  const {
    title,
    slug,
    contentMd,
    contentHtml,
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
  } = validation.data;

  const postSlug = slug ? generateSlug(slug) : generateSlug(title);
  const now = new Date();

  let targetPublishedAt: Date | null = null;
  if (status === "published") {
    targetPublishedAt = publishedAt ? new Date(publishedAt) : (existing.publishedAt || now);
  } else if (status === "scheduled") {
    targetPublishedAt = publishedAt ? new Date(publishedAt) : (existing.publishedAt || now);
  } else if (status === "draft") {
    targetPublishedAt = null;
  } else {
    targetPublishedAt = existing.publishedAt;
  }

  let finalShortUrl = shortUrl !== undefined ? shortUrl : existing.shortUrl;
  let finalDubLinkId = dubLinkId !== undefined ? dubLinkId : existing.dubLinkId;

  if (status === "published" && !finalShortUrl && isDubConfigured()) {
    try {
      const site = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, existing.siteId)).get();
      const siteDomain = site?.domain || "localhost:3000";
      const fullUrl = siteDomain.includes("localhost")
        ? `http://${siteDomain}/entry/${postSlug}`
        : `https://${siteDomain}/entry/${postSlug}`;

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

  db.update(posts)
    .set({
      title,
      slug: postSlug,
      contentMd: normalizeHtmlMediaUrls(contentMd || ""),
      contentHtml: normalizeHtmlMediaUrls(contentHtml || ""),
      excerpt: excerpt || "",
      coverImage: normalizeMediaUrl(coverImage) || null,
      status,
      locale,
      publishedAt: targetPublishedAt,
      updatedAt: now,
      pinned,
      shortUrl: finalShortUrl,
      dubLinkId: finalDubLinkId,
    })
    .where(eq(posts.id, postId))
    .run();

  db.delete(postCategories).where(eq(postCategories.postId, postId)).run();
  if (categoryIds && categoryIds.length > 0) {
    for (const catId of categoryIds) {
      db.insert(postCategories).values({ postId, categoryId: catId }).run();
    }
  }

  db.delete(postTags).where(eq(postTags.postId, postId)).run();
  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      db.insert(postTags).values({ postId, tagId }).run();
    }
  }

  const isNewlyPublished = status === "published" && (!existing.publishedAt || existing.status !== "published");
  if (isNewlyPublished) {
    const notifPayload = {
      id: postId,
      title,
      slug: postSlug,
      excerpt,
      coverImage,
      publishedAt: targetPublishedAt || now,
      locale,
      shortUrl: finalShortUrl,
      tagIds,
    };
    sendDiscordPostNotification(existing.siteId, notifPayload).catch(() => {});
    sendBlueskyPostNotification(existing.siteId, notifPayload).catch(() => {});
  }

  return { success: true, postId };
}

/**
 * Permanently deletes a blog article and cascades removal to junction records.
 *
 * @param postId - Unique database identifier of the article to delete.
 * @returns A Promise resolving to an object indicating success.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function deletePost(postId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const db = getDb();
  db.delete(posts).where(eq(posts.id, postId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all articles belonging to a specific site for administrative management.
 *
 * @param siteId - Unique database identifier of the target site.
 * @returns A Promise resolving to an array of AdminPostRecord items.
 * @throws {Error} When the caller lacks an authorized administrative session.
 */
export async function getAdminPosts(siteId: string): Promise<AdminPostRecord[]> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);
  const db = getDb();

  const list = db
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
    .all();

  return list as AdminPostRecord[];
}

/**
 * Atomically increments the view count for a published blog article.
 *
 * @param postId - Unique database identifier of the post being viewed.
 * @returns A Promise resolving to void when increment is completed.
 */
export async function incrementPostViews(postId: string): Promise<void> {
  const db = getDb();
  db.update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(eq(posts.id, postId))
    .run();
}
