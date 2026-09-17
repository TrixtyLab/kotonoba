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
import { eq, inArray } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getCurrentVersion } from "@/actions/updates";

/**
 * Metadata manifest included within the exported site backup archive.
 */
export interface BackupManifest {
  /** Application version that generated the backup. */
  version: string;
  /** Schema identifier for compatibility verification. */
  format: string;
  /** Format schema version for the backup structure. */
  schemaVersion?: string;
  /** ISO 8601 timestamp when the backup was generated. */
  exportedAt: string;
  /** Core identity metadata of the exported site. */
  site: {
    id: string;
    name: string;
    domain: string;
  };
  /** Summary of bundled entity record counts. */
  counts: {
    posts: number;
    pages: number;
    categories: number;
    tags: number;
    settings: number;
    analyticsSegments: number;
    analytics: number;
    media: number;
  };
}

/**
 * Resolves the absolute directory path where local media uploads are stored.
 *
 * @returns {string} Absolute filesystem path string.
 */
export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
}

/**
 * Recursively scans a directory tree collecting all files with normalized relative paths.
 *
 * @param {string} dir - Directory path to scan recursively.
 * @param {string} [baseDir=dir] - Root directory against which relative paths are computed.
 * @returns {Promise<Array<{ relativePath: string; absolutePath: string }>>} Array of discovered files.
 */
async function collectMediaFiles(
  dir: string,
  baseDir: string = dir
): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const results: Array<{ relativePath: string; absolutePath: string }> = [];
  if (!existsSync(/*turbopackIgnore: true*/ dir)) return results;

  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subResults = await collectMediaFiles(fullPath, baseDir);
        results.push(...subResults);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
        results.push({ relativePath, absolutePath: fullPath });
      }
    }
  } catch {
    // Return partial results if an unreadable directory occurs
  }

  return results;
}

/**
 * Compiles and generates a comprehensive, self-contained ZIP backup archive for a specific tenant site.
 * Packages relational database records (posts, pages, categories, tags, settings, analytics, segments,
 * authors, site branding) and all associated media upload assets.
 *
 * @param {string} siteId - Unique identifier of the site to export.
 * @returns {Promise<{ buffer: Buffer; filename: string; manifest: BackupManifest }>} A Promise resolving to an object containing the ZIP buffer, default filename, and manifest details.
 * @throws {Error} When the target site ID does not exist in the database.
 */
export async function createSiteBackupZip(siteId: string): Promise<{ buffer: Buffer; filename: string; manifest: BackupManifest }> {
  const db = getDb();

  const siteRecord = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!siteRecord) {
    throw new Error(`Site with ID "${siteId}" not found`);
  }

  const settingsList = db.select().from(settings).where(eq(settings.siteId, siteId)).all();
  const categoriesList = db.select().from(categories).where(eq(categories.siteId, siteId)).all();
  const tagsList = db.select().from(tags).where(eq(tags.siteId, siteId)).all();
  const postsList = db.select().from(posts).where(eq(posts.siteId, siteId)).all();
  const pagesList = db.select().from(pages).where(eq(pages.siteId, siteId)).all();
  const analyticsSegmentsList = db.select().from(analyticsSegments).where(eq(analyticsSegments.siteId, siteId)).all();
  const analyticsList = db.select().from(analytics).where(eq(analytics.siteId, siteId)).all();

  const postIds = postsList.map((p) => p.id);
  const postCategoriesList = postIds.length > 0
    ? db.select().from(postCategories).where(inArray(postCategories.postId, postIds)).all()
    : [];
  const postTagsList = postIds.length > 0
    ? db.select().from(postTags).where(inArray(postTags.postId, postIds)).all()
    : [];

  const authorIds = Array.from(new Set([
    ...postsList.map((p) => p.authorId),
    ...pagesList.map((p) => p.authorId),
  ].filter(Boolean)));

  const authorsList = authorIds.length > 0
    ? db.select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, authorIds)).all()
    : [];

  const zip = new JSZip();
  const uploadsFolder = zip.folder("uploads");
  const uploadDir = getUploadDir();
  let mediaCount = 0;

  if (uploadsFolder && existsSync(/*turbopackIgnore: true*/ uploadDir)) {
    const mediaFiles = await collectMediaFiles(uploadDir);
    for (const file of mediaFiles) {
      try {
        const fileData = await fs.readFile(/*turbopackIgnore: true*/ file.absolutePath);
        uploadsFolder.file(file.relativePath, fileData);
        mediaCount++;
      } catch {
        // Skip unreadable files
      }
    }
  }

  const appVersion = await getCurrentVersion();

  const manifest: BackupManifest = {
    version: appVersion,
    schemaVersion: "1.1.0",
    format: "kotonoba-backup",
    exportedAt: new Date().toISOString(),
    site: {
      id: siteRecord.id,
      name: siteRecord.name,
      domain: siteRecord.domain,
    },
    counts: {
      posts: postsList.length,
      pages: pagesList.length,
      categories: categoriesList.length,
      tags: tagsList.length,
      settings: settingsList.length,
      analyticsSegments: analyticsSegmentsList.length,
      analytics: analyticsList.length,
      media: mediaCount,
    },
  };

  const databaseDump = {
    site: siteRecord,
    settings: settingsList,
    categories: categoriesList,
    tags: tagsList,
    posts: postsList,
    pages: pagesList,
    postCategories: postCategoriesList,
    postTags: postTagsList,
    analyticsSegments: analyticsSegmentsList,
    analytics: analyticsList,
    authors: authorsList,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(databaseDump, null, 2));

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeSiteName = siteRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `backup-${safeSiteName || "site"}-${dateSlug}.zip`;

  return { buffer, filename, manifest };
}

