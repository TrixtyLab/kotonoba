"use server";

import { getDb } from "@/lib/db";
import { posts, postCategories, postTags, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { postSchema, validate, type PostInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

export type PostMutationResponse =
  | { success: true; postId: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

export interface AdminPostRecord {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  locale: string;
  views: number;
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
}

/**
 * Creates a new article associated with the authenticated user and current site.
 */
export async function createPost(siteId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const user = await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(postSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { title, slug, contentMd, contentHtml, excerpt, coverImage, status, locale, categoryIds, tagIds, pinned } =
    validation.data;

  const db = getDb();
  const postId = generateId();
  const postSlug = slug ? generateSlug(slug) : generateSlug(title);
  const now = new Date();

  db.insert(posts)
    .values({
      id: postId,
      siteId,
      authorId: user.userId,
      title,
      slug: postSlug,
      contentMd: contentMd || "",
      contentHtml: contentHtml || "",
      excerpt: excerpt || "",
      coverImage: coverImage || null,
      status,
      locale,
      publishedAt: status === "published" ? now : null,
      createdAt: now,
      updatedAt: now,
      views: 0,
      pinned,
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

  revalidatePath("/", "layout");
  return { success: true, postId };
}

/**
 * Updates an existing article and its relational tag/category associations.
 */
export async function updatePost(postId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const user = await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(postSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const db = getDb();
  const existing = db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!existing) {
    return { success: false, error: "Article not found" };
  }

  if (user.role === "author" && existing.authorId !== user.userId) {
    return { success: false, error: "You can only edit your own articles." };
  }

  const { title, slug, contentMd, contentHtml, excerpt, coverImage, status, locale, categoryIds, tagIds, pinned } =
    validation.data;

  const postSlug = slug ? generateSlug(slug) : generateSlug(title);
  const now = new Date();
  const publishedAt =
    status === "published" && !existing.publishedAt ? now : status === "published" ? existing.publishedAt : null;

  db.update(posts)
    .set({
      title,
      slug: postSlug,
      contentMd: contentMd || "",
      contentHtml: contentHtml || "",
      excerpt: excerpt || "",
      coverImage: coverImage || null,
      status,
      locale,
      publishedAt,
      updatedAt: now,
      pinned,
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

  revalidatePath("/", "layout");
  return { success: true, postId };
}

/**
 * Permanently deletes an article and cascading records.
 */
export async function deletePost(postId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const db = getDb();
  db.delete(posts).where(eq(posts.id, postId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves articles for the admin dashboard.
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
 * Increments view counter on a public post.
 */
export async function incrementPostViews(postId: string): Promise<void> {
  const db = getDb();
  db.update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(eq(posts.id, postId))
    .run();
}
