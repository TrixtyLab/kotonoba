import JSZip from "jszip";
import { getDb } from "@/lib/db";
import {
  sites,
  settings,
  categories,
  tags,
  posts,
  pages,
  postCategories,
  postTags,
  users,
  analytics,
  analyticsSegments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { ensureDir } from "@/lib/utils/fs";
import { generateId } from "@/lib/utils/slug";
import { getUploadDir } from "./export";

/** Raw category record structure extracted from backup JSON. */
export interface BackupDataCategory {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

/** Raw tag record structure extracted from backup JSON. */
export interface BackupDataTag {
  id?: string;
  name?: string;
  slug?: string;
}

/** Raw post-category relation extracted from backup JSON. */
export interface BackupDataPostCategory {
  postId: string;
  categoryId: string;
}

/** Raw post-tag relation extracted from backup JSON. */
export interface BackupDataPostTag {
  postId: string;
  tagId: string;
}

/** Raw post record structure extracted from backup JSON. */
export interface BackupDataPost {
  id?: string;
  title?: string;
  slug?: string;
  authorId?: string;
  contentMd?: string;
  contentHtml?: string;
  excerpt?: string;
  coverImage?: string | null;
  status?: string;
  locale?: string;
  publishedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  views?: number;
  pinned?: boolean | number;
  shortUrl?: string | null;
  dubLinkId?: string | null;
}

/** Raw custom page record structure extracted from backup JSON. */
export interface BackupDataPage {
  id?: string;
  title?: string;
  slug?: string;
  authorId?: string;
  contentMd?: string;
  contentHtml?: string;
  excerpt?: string;
  coverImage?: string | null;
  status?: string;
  locale?: string;
  publishedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  views?: number;
}

/** Raw setting record structure extracted from backup JSON. */
export interface BackupDataSetting {
  key?: string;
  value?: string;
}

/** Raw saved analytics segment structure extracted from backup JSON. */
export interface BackupDataSegment {
  id?: string;
  name?: string;
  filters?: string;
  createdAt?: string | number | Date | null;
}

/** Raw visitor analytics event record extracted from backup JSON. */
export interface BackupDataAnalytic {
  id?: number;
  postId?: string | null;
  pageId?: string | null;
  path?: string;
  referrer?: string | null;
  userAgent?: string | null;
  ipHash?: string;
  country?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  language?: string | null;
  sessionId?: string | null;
  loadTime?: number | null;
  timeOnPage?: number | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  createdAt?: string | number | Date | null;
}

/** Raw site branding and visual theme configuration from backup JSON. */
export interface BackupDataSite {
  id?: string;
  name?: string;
  domain?: string;
  subtitle?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  locale?: string;
  theme?: string;
  customCss?: string | null;
  primaryColor?: string;
  fontFamily?: string;
  navLinks?: string;
  navAlignment?: "left" | "center" | "right";
  supportedLocales?: string;
}

/** Root deserialized database dump schema from backup data.json. */
export interface BackupData {
  site?: BackupDataSite;
  categories?: BackupDataCategory[];
  tags?: BackupDataTag[];
  posts?: BackupDataPost[];
  pages?: BackupDataPage[];
  postCategories?: BackupDataPostCategory[];
  postTags?: BackupDataPostTag[];
  settings?: BackupDataSetting[];
  analyticsSegments?: BackupDataSegment[];
  analytics?: BackupDataAnalytic[];
}

/** Configuration options governing the restoration strategy. */
export interface RestoreOptions {
  /** Restoration mode: 'merge' to upsert records, 'replace' to purge existing site data before inserting. */
  mode: "merge" | "replace";
  /** Fallback user ID to assign to posts and pages if author records cannot be matched. */
  currentUserId: string;
}

/** Result outcome of a backup restoration execution. */
export interface RestoreResult {
  /** Success status indicator. */
  success: boolean;
  /** Numerical summary of restored entities across all Kotonoba domains. */
  stats: {
    posts: number;
    pages: number;
    categories: number;
    tags: number;
    settings: number;
    analyticsSegments: number;
    analytics: number;
    media: number;
  };
  /** Error description string if restoration failed. */
  error?: string;
}

/**
 * Restores a tenant site's database records and media assets from a provided ZIP backup archive.
 * Supports both non-destructive merge (upsert) and full clean replace restoration strategies across
 * posts, static pages, categories, tags, settings, analytics events, segments, and site branding.
 *
 * @param {Buffer} zipBuffer - Binary Buffer containing the ZIP archive.
 * @param {string} targetSiteId - Unique identifier of the tenant site receiving the restored data.
 * @param {RestoreOptions} options - Restoration options specifying mode ('merge' | 'replace') and fallback user.
 * @returns {Promise<RestoreResult>} A Promise resolving to a RestoreResult object with entity counts or failure reasons.
 */
export async function restoreSiteBackupZip(
  zipBuffer: Buffer,
  targetSiteId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  const db = getDb();

  const targetSite = db.select().from(sites).where(eq(sites.id, targetSiteId)).get();
  if (!targetSite) {
    return {
      success: false,
      stats: { posts: 0, pages: 0, categories: 0, tags: 0, settings: 0, analyticsSegments: 0, analytics: 0, media: 0 },
      error: `Target site with ID "${targetSiteId}" does not exist.`,
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return {
      success: false,
      stats: { posts: 0, pages: 0, categories: 0, tags: 0, settings: 0, analyticsSegments: 0, analytics: 0, media: 0 },
      error: "Invalid ZIP file format or corrupted archive.",
    };
  }

  const dataFile = zip.file("data.json");
  if (!dataFile) {
    return {
      success: false,
      stats: { posts: 0, pages: 0, categories: 0, tags: 0, settings: 0, analyticsSegments: 0, analytics: 0, media: 0 },
      error: "Archive does not contain a valid 'data.json' file.",
    };
  }

  let rawData: BackupData;
  try {
    const jsonStr = await dataFile.async("string");
    rawData = JSON.parse(jsonStr) as BackupData;
  } catch {
    return {
      success: false,
      stats: { posts: 0, pages: 0, categories: 0, tags: 0, settings: 0, analyticsSegments: 0, analytics: 0, media: 0 },
      error: "Failed to parse data.json from backup archive.",
    };
  }

  const importedCategories = Array.isArray(rawData.categories) ? rawData.categories : [];
  const importedTags = Array.isArray(rawData.tags) ? rawData.tags : [];
  const importedPosts = Array.isArray(rawData.posts) ? rawData.posts : [];
  const importedPages = Array.isArray(rawData.pages) ? rawData.pages : [];
  const importedPostCategories = Array.isArray(rawData.postCategories) ? rawData.postCategories : [];
  const importedPostTags = Array.isArray(rawData.postTags) ? rawData.postTags : [];
  const importedSettings = Array.isArray(rawData.settings) ? rawData.settings : [];
  const importedSegments = Array.isArray(rawData.analyticsSegments) ? rawData.analyticsSegments : [];
  const importedAnalytics = Array.isArray(rawData.analytics) ? rawData.analytics : [];

  let restoredPosts = 0;
  let restoredPages = 0;
  let restoredCategories = 0;
  let restoredTags = 0;
  let restoredSettings = 0;
  let restoredSegments = 0;
  let restoredAnalytics = 0;
  let restoredMedia = 0;

  if (options.mode === "replace") {
    db.delete(analytics).where(eq(analytics.siteId, targetSiteId)).run();
    db.delete(analyticsSegments).where(eq(analyticsSegments.siteId, targetSiteId)).run();
    db.delete(pages).where(eq(pages.siteId, targetSiteId)).run();
    db.delete(posts).where(eq(posts.siteId, targetSiteId)).run();
    db.delete(categories).where(eq(categories.siteId, targetSiteId)).run();
    db.delete(tags).where(eq(tags.siteId, targetSiteId)).run();
    db.delete(settings).where(eq(settings.siteId, targetSiteId)).run();
  }

  if (rawData.site) {
    const s = rawData.site;
    db.update(sites)
      .set({
        subtitle: s.subtitle !== undefined ? (s.subtitle || "") : targetSite.subtitle,
        description: s.description !== undefined ? (s.description || "") : targetSite.description,
        logoUrl: s.logoUrl !== undefined ? s.logoUrl : targetSite.logoUrl,
        faviconUrl: s.faviconUrl !== undefined ? s.faviconUrl : targetSite.faviconUrl,
        theme: s.theme || targetSite.theme,
        customCss: s.customCss !== undefined ? (s.customCss || "") : targetSite.customCss,
        primaryColor: s.primaryColor || targetSite.primaryColor,
        fontFamily: s.fontFamily || targetSite.fontFamily,
        navLinks: s.navLinks || targetSite.navLinks,
        navAlignment: s.navAlignment || targetSite.navAlignment,
        supportedLocales: s.supportedLocales || targetSite.supportedLocales,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, targetSiteId))
      .run();
  }

  const categoryIdMap = new Map<string, string>();
  for (const cat of importedCategories) {
    if (!cat.name || !cat.slug) continue;
    const existing = db
      .select()
      .from(categories)
      .where(and(eq(categories.siteId, targetSiteId), eq(categories.slug, cat.slug)))
      .get();

    if (existing) {
      db.update(categories)
        .set({
          name: cat.name,
          description: cat.description || "",
          sortOrder: typeof cat.sortOrder === "number" ? cat.sortOrder : 0,
        })
        .where(eq(categories.id, existing.id))
        .run();
      if (cat.id) categoryIdMap.set(cat.id, existing.id);
    } else {
      const existingById = cat.id ? db.select({ id: categories.id }).from(categories).where(eq(categories.id, cat.id)).get() : null;
      const newId = (cat.id && !existingById) ? cat.id : generateId();
      db.insert(categories)
        .values({
          id: newId,
          siteId: targetSiteId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || "",
          sortOrder: typeof cat.sortOrder === "number" ? cat.sortOrder : 0,
        })
        .run();
      if (cat.id) categoryIdMap.set(cat.id, newId);
    }
    restoredCategories++;
  }

  const tagIdMap = new Map<string, string>();
  for (const tag of importedTags) {
    if (!tag.name || !tag.slug) continue;
    const existing = db
      .select()
      .from(tags)
      .where(and(eq(tags.siteId, targetSiteId), eq(tags.slug, tag.slug)))
      .get();

    if (existing) {
      if (tag.id) tagIdMap.set(tag.id, existing.id);
    } else {
      const existingById = tag.id ? db.select({ id: tags.id }).from(tags).where(eq(tags.id, tag.id)).get() : null;
      const newId = (tag.id && !existingById) ? tag.id : generateId();
      db.insert(tags)
        .values({
          id: newId,
          siteId: targetSiteId,
          name: tag.name,
          slug: tag.slug,
        })
        .run();
      if (tag.id) tagIdMap.set(tag.id, newId);
    }
    restoredTags++;
  }

  const allUsers = db.select({ id: users.id }).from(users).all();
  const validUserIds = new Set(allUsers.map((u) => u.id));
  let fallbackUserId = options.currentUserId && validUserIds.has(options.currentUserId)
    ? options.currentUserId
    : (allUsers[0]?.id || null);

  if (!fallbackUserId) {
    const defaultId = generateId();
    db.insert(users).values({
      id: defaultId,
      email: `admin@${targetSite.domain || "kotonoba.local"}`,
      passwordHash: "backup_restored_user",
      displayName: "Administrator",
      role: "super_admin",
      siteId: targetSiteId,
    }).run();
    fallbackUserId = defaultId;
    validUserIds.add(defaultId);
  }

  const postIdMap = new Map<string, string>();
  for (const post of importedPosts) {
    if (!post.title || !post.slug) continue;

    const authorId = post.authorId && validUserIds.has(post.authorId)
      ? post.authorId
      : fallbackUserId;

    const existingPost = db
      .select()
      .from(posts)
      .where(and(eq(posts.siteId, targetSiteId), eq(posts.slug, post.slug)))
      .get();

    const postStatus = post.status === "published" || post.status === "archived" || post.status === "scheduled"
      ? post.status
      : "draft";
    let targetPostId: string;

    if (existingPost) {
      targetPostId = existingPost.id;
      db.update(posts)
        .set({
          title: post.title,
          contentMd: post.contentMd || "",
          contentHtml: post.contentHtml || "",
          excerpt: post.excerpt || "",
          coverImage: post.coverImage || null,
          status: postStatus,
          locale: post.locale || "en",
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          updatedAt: new Date(),
          views: typeof post.views === "number" ? post.views : 0,
          pinned: Boolean(post.pinned),
          shortUrl: post.shortUrl !== undefined ? post.shortUrl : existingPost.shortUrl,
          dubLinkId: post.dubLinkId !== undefined ? post.dubLinkId : existingPost.dubLinkId,
        })
        .where(eq(posts.id, existingPost.id))
        .run();

      db.delete(postCategories).where(eq(postCategories.postId, existingPost.id)).run();
      db.delete(postTags).where(eq(postTags.postId, existingPost.id)).run();
    } else {
      const existingById = post.id ? db.select({ id: posts.id }).from(posts).where(eq(posts.id, post.id)).get() : null;
      targetPostId = (post.id && !existingById) ? post.id : generateId();
      db.insert(posts)
        .values({
          id: targetPostId,
          siteId: targetSiteId,
          authorId,
          title: post.title,
          slug: post.slug,
          contentMd: post.contentMd || "",
          contentHtml: post.contentHtml || "",
          excerpt: post.excerpt || "",
          coverImage: post.coverImage || null,
          status: postStatus,
          locale: post.locale || "en",
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
          updatedAt: new Date(),
          views: typeof post.views === "number" ? post.views : 0,
          pinned: Boolean(post.pinned),
          shortUrl: post.shortUrl || null,
          dubLinkId: post.dubLinkId || null,
        })
        .run();
    }

    if (post.id) {
      postIdMap.set(post.id, targetPostId);
    }

    const matchingPostCats = post.id
      ? importedPostCategories.filter((pc) => pc.postId === post.id)
      : [];
    for (const pc of matchingPostCats) {
      const mappedCatId = categoryIdMap.get(pc.categoryId);
      if (mappedCatId) {
        try {
          db.insert(postCategories)
            .values({ postId: targetPostId, categoryId: mappedCatId })
            .run();
        } catch {
          // Ignore duplicate junction constraint
        }
      }
    }

    const matchingPostTags = post.id
      ? importedPostTags.filter((pt) => pt.postId === post.id)
      : [];
    for (const pt of matchingPostTags) {
      const mappedTagId = tagIdMap.get(pt.tagId);
      if (mappedTagId) {
        try {
          db.insert(postTags)
            .values({ postId: targetPostId, tagId: mappedTagId })
            .run();
        } catch {
          // Ignore duplicate junction constraint
        }
      }
    }

    restoredPosts++;
  }

  const pageIdMap = new Map<string, string>();
  for (const page of importedPages) {
    if (!page.title || !page.slug) continue;

    const authorId = page.authorId && validUserIds.has(page.authorId)
      ? page.authorId
      : fallbackUserId;

    const existingPage = db
      .select()
      .from(pages)
      .where(and(eq(pages.siteId, targetSiteId), eq(pages.slug, page.slug)))
      .get();

    const pageStatus = page.status === "published" || page.status === "archived" || page.status === "scheduled"
      ? page.status
      : "draft";
    let targetPageId: string;

    if (existingPage) {
      targetPageId = existingPage.id;
      db.update(pages)
        .set({
          title: page.title,
          contentMd: page.contentMd || "",
          contentHtml: page.contentHtml || "",
          excerpt: page.excerpt || "",
          coverImage: page.coverImage || null,
          status: pageStatus,
          locale: page.locale || "en",
          publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
          updatedAt: new Date(),
          views: typeof page.views === "number" ? page.views : 0,
        })
        .where(eq(pages.id, existingPage.id))
        .run();
    } else {
      const existingById = page.id ? db.select({ id: pages.id }).from(pages).where(eq(pages.id, page.id)).get() : null;
      targetPageId = (page.id && !existingById) ? page.id : generateId();
      db.insert(pages)
        .values({
          id: targetPageId,
          siteId: targetSiteId,
          authorId,
          title: page.title,
          slug: page.slug,
          contentMd: page.contentMd || "",
          contentHtml: page.contentHtml || "",
          excerpt: page.excerpt || "",
          coverImage: page.coverImage || null,
          status: pageStatus,
          locale: page.locale || "en",
          publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
          createdAt: page.createdAt ? new Date(page.createdAt) : new Date(),
          updatedAt: new Date(),
          views: typeof page.views === "number" ? page.views : 0,
        })
        .run();
    }

    if (page.id) {
      pageIdMap.set(page.id, targetPageId);
    }
    restoredPages++;
  }

  for (const s of importedSettings) {
    if (!s.key) continue;
    const existing = db
      .select()
      .from(settings)
      .where(and(eq(settings.siteId, targetSiteId), eq(settings.key, s.key)))
      .get();

    if (existing) {
      db.update(settings)
        .set({ value: s.value || "" })
        .where(eq(settings.id, existing.id))
        .run();
    } else {
      db.insert(settings)
        .values({
          siteId: targetSiteId,
          key: s.key,
          value: s.value || "",
        })
        .run();
    }
    restoredSettings++;
  }

  for (const seg of importedSegments) {
    if (!seg.name) continue;
    const existingSeg = db
      .select()
      .from(analyticsSegments)
      .where(and(eq(analyticsSegments.siteId, targetSiteId), eq(analyticsSegments.name, seg.name)))
      .get();

    if (existingSeg) {
      db.update(analyticsSegments)
        .set({
          filters: seg.filters || "{}",
        })
        .where(eq(analyticsSegments.id, existingSeg.id))
        .run();
    } else {
      const existingById = seg.id ? db.select({ id: analyticsSegments.id }).from(analyticsSegments).where(eq(analyticsSegments.id, seg.id)).get() : null;
      const targetSegId = (seg.id && !existingById) ? seg.id : generateId();
      db.insert(analyticsSegments)
        .values({
          id: targetSegId,
          siteId: targetSiteId,
          name: seg.name,
          filters: seg.filters || "{}",
          createdAt: seg.createdAt ? new Date(seg.createdAt) : new Date(),
        })
        .run();
    }
    restoredSegments++;
  }

  for (const hit of importedAnalytics) {
    if (!hit.path) continue;

    const mappedPostId = hit.postId ? (postIdMap.get(hit.postId) || hit.postId) : null;
    const mappedPageId = hit.pageId ? (pageIdMap.get(hit.pageId) || hit.pageId) : null;

    const validPostId = mappedPostId && db.select({ id: posts.id }).from(posts).where(eq(posts.id, mappedPostId)).get()
      ? mappedPostId
      : null;
    const validPageId = mappedPageId && db.select({ id: pages.id }).from(pages).where(eq(pages.id, mappedPageId)).get()
      ? mappedPageId
      : null;

    try {
      db.insert(analytics)
        .values({
          siteId: targetSiteId,
          postId: validPostId,
          pageId: validPageId,
          path: hit.path,
          referrer: hit.referrer || undefined,
          userAgent: hit.userAgent || "",
          ipHash: hit.ipHash || "backup_hash",
          country: hit.country || undefined,
          city: hit.city || undefined,
          device: hit.device || "desktop",
          browser: hit.browser || undefined,
          os: hit.os || undefined,
          language: hit.language || undefined,
          sessionId: hit.sessionId || undefined,
          loadTime: hit.loadTime || undefined,
          timeOnPage: hit.timeOnPage || 0,
          screenWidth: hit.screenWidth || undefined,
          screenHeight: hit.screenHeight || undefined,
          utmSource: hit.utmSource || undefined,
          utmMedium: hit.utmMedium || undefined,
          utmCampaign: hit.utmCampaign || undefined,
          utmTerm: hit.utmTerm || undefined,
          utmContent: hit.utmContent || undefined,
          createdAt: hit.createdAt ? new Date(hit.createdAt) : new Date(),
        })
        .run();
      restoredAnalytics++;
    } catch {
      // Continue on hit conflict
    }
  }

  const uploadDir = getUploadDir();
  ensureDir(uploadDir);

  const entries = Object.keys(zip.files);
  for (const entryPath of entries) {
    if (entryPath.startsWith("uploads/") && !zip.files[entryPath].dir) {
      const relPath = entryPath.slice("uploads/".length);
      if (!relPath || relPath.includes("..") || path.isAbsolute(relPath)) {
        continue;
      }

      const destPath = path.join(uploadDir, relPath);
      ensureDir(path.dirname(destPath));
      const fileBuffer = await zip.files[entryPath].async("nodebuffer");
      await fs.writeFile(/*turbopackIgnore: true*/ destPath, fileBuffer);
      restoredMedia++;
    }
  }

  return {
    success: true,
    stats: {
      posts: restoredPosts,
      pages: restoredPages,
      categories: restoredCategories,
      tags: restoredTags,
      settings: restoredSettings,
      analyticsSegments: restoredSegments,
      analytics: restoredAnalytics,
      media: restoredMedia,
    },
  };
}
