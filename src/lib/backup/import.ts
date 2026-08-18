import JSZip from "jszip";
import { getDb } from "@/lib/db";
import {
  sites,
  settings,
  categories,
  tags,
  posts,
  postCategories,
  postTags,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { ensureDir } from "@/lib/utils/fs";
import { generateId } from "@/lib/utils/slug";
import { getUploadDir } from "./export";

export interface BackupDataCategory {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface BackupDataTag {
  id?: string;
  name?: string;
  slug?: string;
}

export interface BackupDataPostCategory {
  postId: string;
  categoryId: string;
}

export interface BackupDataPostTag {
  postId: string;
  tagId: string;
}

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
}

export interface BackupDataSetting {
  key?: string;
  value?: string;
}

export interface BackupData {
  categories?: BackupDataCategory[];
  tags?: BackupDataTag[];
  posts?: BackupDataPost[];
  postCategories?: BackupDataPostCategory[];
  postTags?: BackupDataPostTag[];
  settings?: BackupDataSetting[];
}

export interface RestoreOptions {
  mode: "merge" | "replace";
  currentUserId: string;
}

export interface RestoreResult {
  success: boolean;
  stats: {
    posts: number;
    categories: number;
    tags: number;
    settings: number;
    media: number;
  };
  error?: string;
}

/**
 * Restores a site backup from a ZIP buffer into the target site.
 * Supports both "merge" (upsert without deleting existing items) and "replace" (clean overwrite) modes.
 */
export async function restoreSiteBackupZip(
  zipBuffer: Buffer,
  targetSiteId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  const db = getDb();

  // 1. Verify target site exists
  const targetSite = db.select().from(sites).where(eq(sites.id, targetSiteId)).get();
  if (!targetSite) {
    return {
      success: false,
      stats: { posts: 0, categories: 0, tags: 0, settings: 0, media: 0 },
      error: `Target site with ID "${targetSiteId}" does not exist.`,
    };
  }

  // 2. Load ZIP
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    return {
      success: false,
      stats: { posts: 0, categories: 0, tags: 0, settings: 0, media: 0 },
      error: "Invalid ZIP file format or corrupted archive.",
    };
  }

  // 3. Extract manifest and data JSON
  const dataFile = zip.file("data.json");
  if (!dataFile) {
    return {
      success: false,
      stats: { posts: 0, categories: 0, tags: 0, settings: 0, media: 0 },
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
      stats: { posts: 0, categories: 0, tags: 0, settings: 0, media: 0 },
      error: "Failed to parse data.json from backup archive.",
    };
  }

  const importedCategories = Array.isArray(rawData.categories) ? rawData.categories : [];
  const importedTags = Array.isArray(rawData.tags) ? rawData.tags : [];
  const importedPosts = Array.isArray(rawData.posts) ? rawData.posts : [];
  const importedPostCategories = Array.isArray(rawData.postCategories) ? rawData.postCategories : [];
  const importedPostTags = Array.isArray(rawData.postTags) ? rawData.postTags : [];
  const importedSettings = Array.isArray(rawData.settings) ? rawData.settings : [];

  let restoredPosts = 0;
  let restoredCategories = 0;
  let restoredTags = 0;
  let restoredSettings = 0;
  let restoredMedia = 0;

  // 4. If mode is "replace", purge existing site data
  if (options.mode === "replace") {
    // Delete existing posts (cascades postCategories and postTags)
    db.delete(posts).where(eq(posts.siteId, targetSiteId)).run();
    db.delete(categories).where(eq(categories.siteId, targetSiteId)).run();
    db.delete(tags).where(eq(tags.siteId, targetSiteId)).run();
    db.delete(settings).where(eq(settings.siteId, targetSiteId)).run();
  }

  // 5. Restore Categories
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

  // 6. Restore Tags
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

  // 7. Check valid authors or fallback to existing/current user
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

  // 8. Restore Posts
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

    const postStatus = post.status === "published" || post.status === "archived" ? post.status : "draft";
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
        })
        .where(eq(posts.id, existingPost.id))
        .run();

      // Clear existing relations to avoid duplicate keys
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
        })
        .run();
    }

    // Restore Post Categories
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
          // ignore duplicate relation constraint
        }
      }
    }

    // Restore Post Tags
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
          // ignore duplicate relation constraint
        }
      }
    }

    restoredPosts++;
  }

  // 9. Restore Settings
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

  // 10. Extract Media Files to data/uploads
  const uploadDir = getUploadDir();
  ensureDir(uploadDir);

  const entries = Object.keys(zip.files);
  for (const entryPath of entries) {
    if (entryPath.startsWith("uploads/") && !zip.files[entryPath].dir) {
      const filename = path.basename(entryPath);
      // Prevent directory traversal or invalid hidden files
      if (!filename || filename.startsWith(".") || filename.includes("/") || filename.includes("\\")) {
        continue;
      }

      const destPath = path.join(/*turbopackIgnore: true*/ uploadDir, filename);
      const fileBuffer = await zip.files[entryPath].async("nodebuffer");
      await fs.writeFile(destPath, fileBuffer);
      restoredMedia++;
    }
  }

  return {
    success: true,
    stats: {
      posts: restoredPosts,
      categories: restoredCategories,
      tags: restoredTags,
      settings: restoredSettings,
      media: restoredMedia,
    },
  };
}
