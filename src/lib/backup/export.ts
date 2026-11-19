import crypto from "crypto";
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
import { getRuntimeUploadDir } from "@/lib/config/env";
import { encryptBackupArchive } from "./crypto";

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
  /** SHA-256 hex digest of `data.json` used to detect corruption or tampering. */
  checksum?: string;
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
      if (entry.isSymbolicLink()) continue;
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
 * Compiles and generates a comprehensive, self-contained encrypted backup archive for a specific tenant site.
 * Packages only the target site's relational database records and tenant-scoped media upload assets.
 *
 * @param {string} siteId - Unique identifier of the site to export.
 * @returns {Promise<{ buffer: Buffer; filename: string; manifest: BackupManifest }>} Encrypted backup buffer, filename, and manifest.
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
  const uploadDir = getRuntimeUploadDir();
  const tenantUploadDir = path.join(/*turbopackIgnore: true*/ uploadDir, "sites", siteId);
  let mediaCount = 0;

  if (uploadsFolder && existsSync(/*turbopackIgnore: true*/ tenantUploadDir)) {
    const mediaFiles = await collectMediaFiles(tenantUploadDir, tenantUploadDir);
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

  // Also bundle legacy root uploads explicitly referenced by this tenant's own records.
  if (uploadsFolder && existsSync(/*turbopackIgnore: true*/ uploadDir)) {
    const referencedRelPaths = new Set<string>();
    const serialized = JSON.stringify({
      siteRecord,
      settingsList,
      postsList: postsList.map((p) => [p.coverImage, p.contentMd, p.contentHtml]),
      pagesList: pagesList.map((p) => [p.coverImage, p.contentMd, p.contentHtml]),
    });
    const legacyUploadRegex = /\/api\/uploads\/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*)/g;
    let m: RegExpExecArray | null;
    while ((m = legacyUploadRegex.exec(serialized)) !== null) {
      const candidate = m[1];
      if (!candidate.startsWith("sites/") && !candidate.includes("..")) {
        referencedRelPaths.add(candidate);
      }
    }

    const rootResolved = path.resolve(/*turbopackIgnore: true*/ uploadDir);
    for (const rel of referencedRelPaths) {
      try {
        const abs = path.resolve(/*turbopackIgnore: true*/ rootResolved, rel);
        if (abs.startsWith(rootResolved + path.sep) && existsSync(/*turbopackIgnore: true*/ abs)) {
          const stat = await fs.stat(/*turbopackIgnore: true*/ abs);
          if (stat.isFile()) {
            const fileData = await fs.readFile(/*turbopackIgnore: true*/ abs);
            uploadsFolder.file(rel, fileData);
            mediaCount++;
          }
        }
      } catch {
        // Skip inaccessible legacy asset
      }
    }
  }

  const appVersion = await getCurrentVersion();

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

  const dataJson = JSON.stringify(databaseDump, null, 2);
  const checksum = crypto.createHash("sha256").update(dataJson, "utf8").digest("hex");

  const manifest: BackupManifest = {
    version: appVersion,
    schemaVersion: "1.2.0",
    format: "kotonoba-backup",
    exportedAt: new Date().toISOString(),
    checksum,
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

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", dataJson);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const encrypted = encryptBackupArchive(zipBuffer);

  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeSiteName = siteRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `backup-${safeSiteName || "site"}-${dateSlug}.kotonoba-backup`;

  return { buffer: encrypted.buffer, filename, manifest };
}
