import { and, eq } from "drizzle-orm";
import type { DatabaseInstance } from "@/lib/db/migrate";
import {
  analytics,
  analyticsSegments,
  categories,
  pages,
  postCategories,
  posts,
  postTags,
  settings,
  sites,
  tags,
  users,
} from "@/lib/db/schema";
import { LOCALES } from "@/i18n/locales";
import { POST_STATUS, ROLES, type PostStatus } from "@/lib/config/constants";
import { resolveCanonicalContent } from "@/lib/content/canonical";
import { sanitizeCss, sanitizeNavLinksJson, sanitizeUrl } from "@/lib/security/sanitize";
import { generateId } from "@/lib/utils/slug";
import {
  restoreAnalyticsHitRows,
  restoreAnalyticsSegmentsRows,
  restoreSiteSettingsRows,
} from "./db-restore-analytics";
import type { BackupData, RestoreOptions, RestoreStats } from "./types";

export type DbTx = Parameters<Parameters<DatabaseInstance["transaction"]>[0]>[0];

function normalizeLocale(raw?: string | null): "en" | "es" {
  return raw && (LOCALES as readonly string[]).includes(raw) ? (raw as "en" | "es") : "en";
}

function normalizeRestoredStatus(raw?: string): PostStatus {
  if (raw === POST_STATUS.PUBLISHED || raw === POST_STATUS.ARCHIVED || raw === POST_STATUS.SCHEDULED) {
    return raw;
  }
  return POST_STATUS.DRAFT;
}

function rewriteSiteMediaUrl(
  rawUrl: string | null | undefined,
  sourceSiteId: string | undefined,
  targetSiteId: string
): string | null {
  const safe = sanitizeUrl(rawUrl, { allowRelative: true });
  if (!safe) return null;
  if (sourceSiteId && sourceSiteId !== targetSiteId && safe.startsWith(`/api/uploads/sites/${sourceSiteId}/`)) {
    return `/api/uploads/sites/${targetSiteId}/${safe.slice(`/api/uploads/sites/${sourceSiteId}/`.length)}`;
  }
  return safe;
}

function rewriteSiteMediaInBody(body: string, sourceSiteId: string | undefined, targetSiteId: string): string {
  if (!body || !sourceSiteId || sourceSiteId === targetSiteId) return body;
  return body.replaceAll(`/api/uploads/sites/${sourceSiteId}/`, `/api/uploads/sites/${targetSiteId}/`);
}

function resolveFallbackAuthor(tx: DbTx, targetSiteId: string, domain: string, preferredUserId?: string): {
  validUserIds: Set<string>;
  fallbackUserId: string;
} {
  const allUsers = tx.select({ id: users.id }).from(users).all();
  const validUserIds = new Set(allUsers.map((u) => u.id));
  if (preferredUserId && validUserIds.has(preferredUserId)) {
    return { validUserIds, fallbackUserId: preferredUserId };
  }
  if (allUsers[0]?.id) {
    return { validUserIds, fallbackUserId: allUsers[0].id };
  }
  const defaultId = generateId();
  tx.insert(users)
    .values({
      id: defaultId,
      email: `admin@${domain || "kotonoba.local"}`,
      passwordHash: "backup_restored_user",
      displayName: "Administrator",
      role: ROLES.SUPER_ADMIN,
      siteId: targetSiteId,
      tokenVersion: 1,
      createdAt: new Date(),
    })
    .run();
  validUserIds.add(defaultId);
  return { validUserIds, fallbackUserId: defaultId };
}

function upsertRestoredCategory(
  tx: DbTx,
  targetSiteId: string,
  cat: NonNullable<BackupData["categories"]>[number],
  categoryIdMap: Map<string, string>,
  stats: RestoreStats
): void {
  if (!cat.name || !cat.slug) return;
  const sortOrder = typeof cat.sortOrder === "number" ? cat.sortOrder : 0;
  const existing = tx.select().from(categories).where(and(eq(categories.siteId, targetSiteId), eq(categories.slug, cat.slug))).get();
  if (existing) {
    tx.update(categories).set({ name: cat.name, description: cat.description || "", sortOrder }).where(eq(categories.id, existing.id)).run();
    if (cat.id) categoryIdMap.set(cat.id, existing.id);
  } else {
    const existingById = cat.id ? tx.select({ id: categories.id }).from(categories).where(eq(categories.id, cat.id)).get() : null;
    const newId = cat.id && !existingById ? cat.id : generateId();
    tx.insert(categories).values({ id: newId, siteId: targetSiteId, name: cat.name, slug: cat.slug, description: cat.description || "", sortOrder }).run();
    if (cat.id) categoryIdMap.set(cat.id, newId);
  }
  stats.categories++;
}

function upsertRestoredTag(
  tx: DbTx,
  targetSiteId: string,
  tag: NonNullable<BackupData["tags"]>[number],
  tagIdMap: Map<string, string>,
  stats: RestoreStats
): void {
  if (!tag.name || !tag.slug) return;
  const existing = tx.select().from(tags).where(and(eq(tags.siteId, targetSiteId), eq(tags.slug, tag.slug))).get();
  if (existing) {
    if (tag.id) tagIdMap.set(tag.id, existing.id);
  } else {
    const existingById = tag.id ? tx.select({ id: tags.id }).from(tags).where(eq(tags.id, tag.id)).get() : null;
    const newId = tag.id && !existingById ? tag.id : generateId();
    tx.insert(tags).values({ id: newId, siteId: targetSiteId, name: tag.name, slug: tag.slug }).run();
    if (tag.id) tagIdMap.set(tag.id, newId);
  }
  stats.tags++;
}

function restoreTaxonomies(
  tx: DbTx,
  targetSiteId: string,
  rawData: BackupData,
  stats: RestoreStats
): { categoryIdMap: Map<string, string>; tagIdMap: Map<string, string> } {
  const categoryIdMap = new Map<string, string>();
  for (const cat of Array.isArray(rawData.categories) ? rawData.categories : []) {
    upsertRestoredCategory(tx, targetSiteId, cat, categoryIdMap, stats);
  }
  const tagIdMap = new Map<string, string>();
  for (const tag of Array.isArray(rawData.tags) ? rawData.tags : []) {
    upsertRestoredTag(tx, targetSiteId, tag, tagIdMap, stats);
  }
  return { categoryIdMap, tagIdMap };
}

function buildRestoredBodyFields(
  record: { content?: string | null; contentMd?: string | null; contentHtml?: string | null; contentFormat?: string | null; coverImage?: string | null; status?: string | null; locale?: string | null },
  sourceSiteId: string | undefined,
  targetSiteId: string
) {
  const format = record.contentFormat === "html" || record.contentFormat === "markdown" ? record.contentFormat : undefined;
  return {
    status: normalizeRestoredStatus(record.status ?? undefined),
    canonical: resolveCanonicalContent(
      rewriteSiteMediaInBody(record.contentMd || "", sourceSiteId, targetSiteId),
      rewriteSiteMediaInBody(record.contentHtml || "", sourceSiteId, targetSiteId),
      format,
      rewriteSiteMediaInBody(record.content || "", sourceSiteId, targetSiteId)
    ),
    safeCover: rewriteSiteMediaUrl(record.coverImage, sourceSiteId, targetSiteId),
    locale: normalizeLocale(record.locale),
  };
}

function syncPostRelations(
  tx: DbTx,
  targetPostId: string,
  sourcePostId: string | undefined,
  importedPostCategories: NonNullable<BackupData["postCategories"]>,
  importedPostTags: NonNullable<BackupData["postTags"]>,
  categoryIdMap: Map<string, string>,
  tagIdMap: Map<string, string>
): void {
  if (!sourcePostId) return;
  for (const pc of importedPostCategories) {
    if (pc.postId !== sourcePostId) continue;
    const mappedCatId = categoryIdMap.get(pc.categoryId);
    if (mappedCatId) tx.insert(postCategories).values({ postId: targetPostId, categoryId: mappedCatId }).onConflictDoNothing().run();
  }
  for (const pt of importedPostTags) {
    if (pt.postId !== sourcePostId) continue;
    const mappedTagId = tagIdMap.get(pt.tagId);
    if (mappedTagId) tx.insert(postTags).values({ postId: targetPostId, tagId: mappedTagId }).onConflictDoNothing().run();
  }
}

function upsertRestoredPost(
  tx: DbTx,
  targetSiteId: string,
  sourceSiteId: string | undefined,
  post: NonNullable<BackupData["posts"]>[number],
  authorId: string
): string {
  const existingPost = tx.select().from(posts).where(and(eq(posts.siteId, targetSiteId), eq(posts.slug, post.slug!))).get();
  const { status, canonical, safeCover, locale } = buildRestoredBodyFields(post, sourceSiteId, targetSiteId);
  const safeShortUrl = post.shortUrl ? sanitizeUrl(post.shortUrl, { allowRelative: false }) : null;
  const views = typeof post.views === "number" ? post.views : 0;
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

  if (existingPost) {
    tx.update(posts)
      .set({
        title: post.title!, content: canonical.content, contentMd: canonical.contentMd, contentHtml: canonical.contentHtml, contentFormat: canonical.contentFormat,
        excerpt: post.excerpt || "", coverImage: safeCover, status, locale, publishedAt, updatedAt: new Date(), views,
        pinned: Boolean(post.pinned),
        shortUrl: safeShortUrl !== null ? safeShortUrl : existingPost.shortUrl,
        dubLinkId: post.dubLinkId !== undefined ? post.dubLinkId : existingPost.dubLinkId,
      })
      .where(eq(posts.id, existingPost.id))
      .run();
    tx.delete(postCategories).where(eq(postCategories.postId, existingPost.id)).run();
    tx.delete(postTags).where(eq(postTags.postId, existingPost.id)).run();
    return existingPost.id;
  }

  const existingById = post.id ? tx.select({ id: posts.id }).from(posts).where(eq(posts.id, post.id)).get() : null;
  const targetPostId = post.id && !existingById ? post.id : generateId();
  tx.insert(posts)
    .values({
      id: targetPostId, siteId: targetSiteId, authorId, title: post.title!, slug: post.slug!,
      content: canonical.content, contentMd: canonical.contentMd, contentHtml: canonical.contentHtml, contentFormat: canonical.contentFormat,
      excerpt: post.excerpt || "", coverImage: safeCover, status, locale, publishedAt,
      createdAt: post.createdAt ? new Date(post.createdAt) : new Date(), updatedAt: new Date(),
      views, pinned: Boolean(post.pinned), shortUrl: safeShortUrl, dubLinkId: post.dubLinkId || null,
    })
    .run();
  return targetPostId;
}

function restorePosts(
  tx: DbTx,
  targetSiteId: string,
  sourceSiteId: string | undefined,
  rawData: BackupData,
  validUserIds: Set<string>,
  fallbackUserId: string,
  categoryIdMap: Map<string, string>,
  tagIdMap: Map<string, string>,
  stats: RestoreStats
): Map<string, string> {
  const postIdMap = new Map<string, string>();
  const importedPostCategories = Array.isArray(rawData.postCategories) ? rawData.postCategories : [];
  const importedPostTags = Array.isArray(rawData.postTags) ? rawData.postTags : [];

  for (const post of Array.isArray(rawData.posts) ? rawData.posts : []) {
    if (!post.title || !post.slug) continue;
    const authorId = post.authorId && validUserIds.has(post.authorId) ? post.authorId : fallbackUserId;
    const targetPostId = upsertRestoredPost(tx, targetSiteId, sourceSiteId, post, authorId);
    if (post.id) postIdMap.set(post.id, targetPostId);
    syncPostRelations(tx, targetPostId, post.id, importedPostCategories, importedPostTags, categoryIdMap, tagIdMap);
    stats.posts++;
  }
  return postIdMap;
}

function upsertRestoredPage(
  tx: DbTx,
  targetSiteId: string,
  sourceSiteId: string | undefined,
  page: NonNullable<BackupData["pages"]>[number],
  authorId: string
): string {
  const existingPage = tx.select().from(pages).where(and(eq(pages.siteId, targetSiteId), eq(pages.slug, page.slug!))).get();
  const { status, canonical, safeCover, locale } = buildRestoredBodyFields(page, sourceSiteId, targetSiteId);
  const views = typeof page.views === "number" ? page.views : 0;
  const publishedAt = page.publishedAt ? new Date(page.publishedAt) : null;

  if (existingPage) {
    tx.update(pages)
      .set({
        title: page.title!, content: canonical.content, contentMd: canonical.contentMd, contentHtml: canonical.contentHtml, contentFormat: canonical.contentFormat,
        excerpt: page.excerpt || "", coverImage: safeCover, status, locale, publishedAt, updatedAt: new Date(), views,
      })
      .where(eq(pages.id, existingPage.id))
      .run();
    return existingPage.id;
  }

  const existingById = page.id ? tx.select({ id: pages.id }).from(pages).where(eq(pages.id, page.id)).get() : null;
  const targetPageId = page.id && !existingById ? page.id : generateId();
  tx.insert(pages)
    .values({
      id: targetPageId, siteId: targetSiteId, authorId, title: page.title!, slug: page.slug!,
      content: canonical.content, contentMd: canonical.contentMd, contentHtml: canonical.contentHtml, contentFormat: canonical.contentFormat,
      excerpt: page.excerpt || "", coverImage: safeCover, status, locale, publishedAt,
      createdAt: page.createdAt ? new Date(page.createdAt) : new Date(), updatedAt: new Date(), views,
    })
    .run();
  return targetPageId;
}

function restorePages(
  tx: DbTx,
  targetSiteId: string,
  sourceSiteId: string | undefined,
  rawData: BackupData,
  validUserIds: Set<string>,
  fallbackUserId: string,
  stats: RestoreStats
): Map<string, string> {
  const pageIdMap = new Map<string, string>();
  for (const page of Array.isArray(rawData.pages) ? rawData.pages : []) {
    if (!page.title || !page.slug) continue;
    const authorId = page.authorId && validUserIds.has(page.authorId) ? page.authorId : fallbackUserId;
    const targetPageId = upsertRestoredPage(tx, targetSiteId, sourceSiteId, page, authorId);
    if (page.id) pageIdMap.set(page.id, targetPageId);
    stats.pages++;
  }
  return pageIdMap;
}

function clearTargetSiteForReplace(tx: DbTx, targetSiteId: string): void {
  tx.delete(analytics).where(eq(analytics.siteId, targetSiteId)).run();
  tx.delete(analyticsSegments).where(eq(analyticsSegments.siteId, targetSiteId)).run();
  tx.delete(pages).where(eq(pages.siteId, targetSiteId)).run();
  tx.delete(posts).where(eq(posts.siteId, targetSiteId)).run();
  tx.delete(categories).where(eq(categories.siteId, targetSiteId)).run();
  tx.delete(tags).where(eq(tags.siteId, targetSiteId)).run();
  tx.delete(settings).where(eq(settings.siteId, targetSiteId)).run();
}

function updateRestoredSiteConfig(
  tx: DbTx,
  targetSite: typeof sites.$inferSelect,
  s: NonNullable<BackupData["site"]>,
  sourceSiteId: string | undefined
): void {
  tx.update(sites)
    .set({
      subtitle: s.subtitle !== undefined ? s.subtitle || "" : targetSite.subtitle,
      description: s.description !== undefined ? s.description || "" : targetSite.description,
      logoUrl: s.logoUrl !== undefined ? rewriteSiteMediaUrl(s.logoUrl, sourceSiteId, targetSite.id) : targetSite.logoUrl,
      faviconUrl: s.faviconUrl !== undefined ? rewriteSiteMediaUrl(s.faviconUrl, sourceSiteId, targetSite.id) : targetSite.faviconUrl,
      theme: s.theme === "light" || s.theme === "dark" ? s.theme : targetSite.theme,
      customCss: s.customCss !== undefined ? sanitizeCss(s.customCss) : targetSite.customCss,
      primaryColor: s.primaryColor || targetSite.primaryColor,
      fontFamily: s.fontFamily || targetSite.fontFamily,
      navLinks: s.navLinks ? sanitizeNavLinksJson(s.navLinks) : targetSite.navLinks,
      navAlignment: s.navAlignment || targetSite.navAlignment,
      supportedLocales: s.supportedLocales || targetSite.supportedLocales,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, targetSite.id))
    .run();
}

/** Runs transactional SQLite restoration (with replace-mode cleanup, sanitization, and secret encryption). */
export function executeBackupDbTransaction(
  db: DatabaseInstance,
  targetSite: typeof sites.$inferSelect,
  rawData: BackupData,
  options: RestoreOptions,
  stats: RestoreStats
): void {
  const sourceSiteId = rawData.site?.id;
  db.transaction((tx) => {
    if (options.mode === "replace") clearTargetSiteForReplace(tx, targetSite.id);
    if (rawData.site) updateRestoredSiteConfig(tx, targetSite, rawData.site, sourceSiteId);

    const { categoryIdMap, tagIdMap } = restoreTaxonomies(tx, targetSite.id, rawData, stats);
    const { validUserIds, fallbackUserId } = resolveFallbackAuthor(tx, targetSite.id, targetSite.domain, options.currentUserId);
    const postIdMap = restorePosts(tx, targetSite.id, sourceSiteId, rawData, validUserIds, fallbackUserId, categoryIdMap, tagIdMap, stats);
    const pageIdMap = restorePages(tx, targetSite.id, sourceSiteId, rawData, validUserIds, fallbackUserId, stats);
    restoreSiteSettingsRows(tx, targetSite.id, rawData.settings, stats);
    restoreAnalyticsSegmentsRows(tx, targetSite.id, rawData.analyticsSegments, stats);
    restoreAnalyticsHitRows(tx, targetSite.id, rawData.analytics, postIdMap, pageIdMap, stats);
  });
}
