import { getDb } from "@/lib/db";
import { pages, users, analytics } from "@/lib/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { generateId, generateSlug } from "@/lib/utils/slug";
import type { PageInput } from "@/lib/security/validate";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { resolveCanonicalContent } from "@/lib/content/canonical";
import { recordAuditEvent } from "@/lib/security/audit";

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
  status: "draft" | "published" | "scheduled" | "archived";
  locale: string;
  views: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
}

/**
 * Creates a custom static page with tenant slug uniqueness and sanitized canonical body.
 */
export function createPageService(
  actor: TokenPayload,
  siteId: string,
  data: PageInput
): { result: PageMutationResponse; pageSlug?: string } {
  const { title, slug, contentMd, contentHtml, contentFormat, excerpt, coverImage, status, publishedAt, locale } = data;
  const db = getDb();
  const pageId = generateId();
  const pageSlug = slug ? generateSlug(slug) : generateSlug(title);

  const duplicateSlug = db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.slug, pageSlug)))
    .get();
  if (duplicateSlug) {
    return {
      result: { success: false, errors: { slug: ["A page with this slug already exists in this site."] } },
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

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat);
  const safeCoverImage = coverImage ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true }) : null;

  db.insert(pages)
    .values({
      id: pageId,
      siteId,
      authorId: actor.userId,
      title,
      slug: pageSlug,
      contentMd: canonical.contentMd,
      contentHtml: canonical.contentHtml,
      contentFormat: canonical.contentFormat,
      excerpt: excerpt || "",
      coverImage: safeCoverImage,
      status,
      locale: locale || "en",
      publishedAt: targetPublishedAt,
      createdAt: now,
      updatedAt: now,
      views: 0,
    })
    .run();

  return { result: { success: true, pageId }, pageSlug };
}

/** Loads page row by ID. */
export function getPageRowById(pageId: string) {
  return getDb().select().from(pages).where(eq(pages.id, pageId)).get() || null;
}

/**
 * Updates an existing custom static page enforcing author ownership and `(siteId, slug)` uniqueness.
 */
export function updatePageService(
  actor: TokenPayload,
  existing: NonNullable<ReturnType<typeof getPageRowById>>,
  data: PageInput
): { result: PageMutationResponse; pageSlug?: string } {
  if (actor.role === "author" && existing.authorId !== actor.userId) {
    return { result: { success: false, error: "You can only edit your own pages." } };
  }

  const { title, slug, contentMd, contentHtml, contentFormat, excerpt, coverImage, status, publishedAt, locale } = data;
  const db = getDb();
  const now = new Date();
  const pageSlug = slug ? generateSlug(slug) : existing.slug;

  const duplicateSlug = db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, existing.siteId), eq(pages.slug, pageSlug), ne(pages.id, existing.id)))
    .get();
  if (duplicateSlug) {
    return {
      result: { success: false, errors: { slug: ["A page with this slug already exists in this site."] } },
    };
  }

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

  const canonical = resolveCanonicalContent(contentMd, contentHtml, contentFormat);
  const safeCoverImage =
    coverImage !== undefined
      ? coverImage
        ? sanitizeUrl(normalizeMediaUrl(coverImage), { allowRelative: true })
        : null
      : existing.coverImage;

  db.update(pages)
    .set({
      title,
      slug: pageSlug,
      contentMd: canonical.contentMd,
      contentHtml: canonical.contentHtml,
      contentFormat: canonical.contentFormat,
      excerpt: excerpt || "",
      coverImage: safeCoverImage,
      status,
      locale: locale || existing.locale,
      publishedAt: targetPublishedAt,
      updatedAt: now,
    })
    .where(eq(pages.id, existing.id))
    .run();

  return { result: { success: true, pageId: existing.id }, pageSlug };
}

/** Deletes a static page, associated analytics, and emits an audit event. */
export function deletePageService(
  actor: TokenPayload,
  pageId: string
): { success: boolean; error?: string; slug?: string } {
  const db = getDb();
  const existing = db.select().from(pages).where(eq(pages.id, pageId)).get();
  if (!existing) {
    return { success: false, error: "Page not found" };
  }

  db.delete(analytics).where(eq(analytics.pageId, pageId)).run();
  db.delete(pages).where(eq(pages.id, pageId)).run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: existing.siteId,
    action: "page.delete",
    targetType: "page",
    targetId: pageId,
    metadata: { slug: existing.slug },
  });

  return { success: true, slug: existing.slug };
}

/** Lists custom pages for admin panel listings. */
export function listAdminPages(siteId: string): AdminPageRecord[] {
  return getDb()
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
}

/** Lists lightweight published page descriptors for navigation link pickers. */
export function listPublishedPages(siteId: string): Array<{ id: string; title: string; slug: string; locale: string }> {
  return getDb()
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
}
