"use server";

import { getDb } from "@/lib/db";
import { pages, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { pageSchema, validate, type PageInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from custom page creation or update operations.
 */
export type PageMutationResponse =
  | { success: true; pageId: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Overview page structure formatted for administration listings.
 */
export interface AdminPageRecord {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  locale: string;
  views: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
}

/**
 * Creates a new custom page associated with the authenticated user and active site.
 *
 * @param {string} siteId - Unique database identifier of the target site.
 * @param {Partial<PageInput>} inputData - Page attributes including title, markdown/html content, and publication status.
 * @returns {Promise<PageMutationResponse>} A Promise resolving to a PageMutationResponse with the created page ID or validation errors.
 * @throws {Error} Thrown if the requesting user session is unauthenticated or lacks author permissions.
 */
export async function createPage(siteId: string, inputData: Partial<PageInput>): Promise<PageMutationResponse> {
  const user = await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(pageSchema, inputData);

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
    locale,
  } = validation.data;

  const db = getDb();
  const pageId = generateId();
  const pageSlug = slug ? generateSlug(slug) : generateSlug(title);
  const now = new Date();

  db.insert(pages).values({
    id: pageId,
    siteId,
    authorId: user.userId,
    title,
    slug: pageSlug,
    contentMd: contentMd || "",
    contentHtml: contentHtml || "",
    excerpt: excerpt || "",
    coverImage: coverImage || null,
    status,
    locale: locale || "en",
    publishedAt: status === "published" ? now : null,
    createdAt: now,
    updatedAt: now,
    views: 0,
  }).run();

  revalidatePath("/[locale]/admin/pages", "page");
  revalidatePath(`/[locale]/p/${pageSlug}`, "page");
  revalidatePath("/sitemap.xml", "page");

  return { success: true, pageId };
}

/**
 * Updates an existing custom page entity.
 *
 * @param {string} pageId - Database identifier of the target page.
 * @param {Partial<PageInput>} inputData - Updated page attributes including title, content, excerpt, or status.
 * @returns {Promise<PageMutationResponse>} A Promise resolving to a PageMutationResponse indicating success or validation errors.
 * @throws {Error} Thrown if the requesting user session is unauthenticated or lacks editor permissions.
 */
export async function updatePage(pageId: string, inputData: Partial<PageInput>): Promise<PageMutationResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(pageSchema, inputData);

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
    locale,
  } = validation.data;

  const db = getDb();
  const existing = db.select().from(pages).where(eq(pages.id, pageId)).get();
  if (!existing) {
    return { success: false, error: "Page not found" };
  }

  const now = new Date();
  const pageSlug = slug ? generateSlug(slug) : existing.slug;
  const shouldSetPublishedAt = status === "published" && !existing.publishedAt;

  db.update(pages).set({
    title,
    slug: pageSlug,
    contentMd: contentMd || "",
    contentHtml: contentHtml || "",
    excerpt: excerpt || "",
    coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
    status,
    locale: locale || existing.locale,
    publishedAt: shouldSetPublishedAt ? now : (status === "draft" ? null : existing.publishedAt),
    updatedAt: now,
  }).where(eq(pages.id, pageId)).run();

  revalidatePath("/[locale]/admin/pages", "page");
  revalidatePath(`/[locale]/p/${pageSlug}`, "page");
  revalidatePath("/sitemap.xml", "page");

  return { success: true, pageId };
}

/**
 * Deletes a custom page by its database identifier.
 *
 * @param {string} pageId - Database identifier of the page to delete.
 * @returns {Promise<{ success: boolean; error?: string }>} A Promise resolving to an object indicating operation success.
 * @throws {Error} Thrown if the requesting user is unauthenticated or lacks deletion permissions.
 */
export async function deletePage(pageId: string): Promise<{ success: boolean; error?: string }> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const db = getDb();

  const existing = db.select().from(pages).where(eq(pages.id, pageId)).get();
  if (!existing) {
    return { success: false, error: "Page not found" };
  }

  db.delete(pages).where(eq(pages.id, pageId)).run();

  revalidatePath("/[locale]/admin/pages", "page");
  revalidatePath(`/[locale]/p/${existing.slug}`, "page");
  revalidatePath("/sitemap.xml", "page");

  return { success: true };
}

/**
 * Retrieves all custom pages for the given site for the admin panel.
 *
 * @param {string} siteId - Identifier of the active site.
 * @returns {Promise<AdminPageRecord[]>} A Promise resolving to an array of AdminPageRecord objects.
 * @throws {Error} Thrown if the requesting user is unauthenticated.
 */
export async function getPages(siteId: string): Promise<AdminPageRecord[]> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);
  const db = getDb();

  const rows = db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      locale: pages.locale,
      views: pages.views,
      publishedAt: pages.publishedAt,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      authorName: users.displayName,
    })
    .from(pages)
    .leftJoin(users, eq(pages.authorId, users.id))
    .where(eq(pages.siteId, siteId))
    .orderBy(desc(pages.createdAt))
    .all();

  return rows;
}

/**
 * Retrieves published custom pages for navigation selectors and link pickers.
 *
 * @param {string} siteId - Identifier of the active site.
 * @returns {Promise<Array<{ id: string; title: string; slug: string; locale: string }>>} A Promise resolving to an array of simplified page descriptor objects.
 */
export async function getPublishedPages(siteId: string): Promise<Array<{ id: string; title: string; slug: string; locale: string }>> {
  const db = getDb();

  const rows = db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      locale: pages.locale,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.status, "published")))
    .orderBy(desc(pages.createdAt))
    .all();

  return rows;
}

/**
 * Retrieves a full custom page by ID for editing.
 *
 * @param {string} pageId - Identifier of the target page.
 * @returns {Promise<typeof pages.$inferSelect | null>} A Promise resolving to the page record or null if not found.
 * @throws {Error} Thrown if the requesting user is unauthenticated.
 */
export async function getPageById(pageId: string) {
  await requireAuth(["super_admin", "admin", "editor", "author"]);
  const db = getDb();
  return db.select().from(pages).where(eq(pages.id, pageId)).get() || null;
}

/**
 * Retrieves a published custom page by its site and slug for public display.
 *
 * @param {string} siteId - Identifier of the target site.
 * @param {string} slug - Page URL slug.
 * @returns {Promise<typeof pages.$inferSelect | null>} A Promise resolving to the published page record or null if not found.
 */
export async function getPageBySlug(siteId: string, slug: string) {
  const db = getDb();
  return db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, slug), eq(pages.status, "published")))
    .get() || null;
}
