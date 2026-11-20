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
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { ensureDir } from "@/lib/utils/fs";
import { generateId } from "@/lib/utils/slug";
import { getEnvConfig, getRuntimeUploadDir } from "@/lib/config/env";
import { LOCALES } from "@/i18n/locales";
import { sanitizeCss, sanitizeNavLinksJson, sanitizeUrl } from "@/lib/security/sanitize";
import { encryptSecret, isEncryptedSecret } from "@/lib/security/crypto";
import { SECRET_SETTING_KEYS } from "@/lib/config/settings-keys";
import { resolveCanonicalContent } from "@/lib/content/canonical";
import { createSiteBackupZip, type BackupManifest } from "./export";
import {
  decryptBackupArchive,
  isEncryptedBackup,
  isLegacyBackupImportEnabled,
} from "./crypto";

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
  contentFormat?: "html" | "markdown";
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
  contentFormat?: "html" | "markdown";
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
  success: boolean;
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
  snapshotPath?: string;
  error?: string;
}

function normalizeLocale(raw?: string | null): "en" | "es" {
  return raw && (LOCALES as readonly string[]).includes(raw) ? (raw as "en" | "es") : "en";
}

function emptyStats() {
  return {
    posts: 0,
    pages: 0,
    categories: 0,
    tags: 0,
    settings: 0,
    analyticsSegments: 0,
    analytics: 0,
    media: 0,
  };
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

function rewriteSiteMediaInBody(
  body: string,
  sourceSiteId: string | undefined,
  targetSiteId: string
): string {
  if (!body || !sourceSiteId || sourceSiteId === targetSiteId) return body;
  return body.replaceAll(`/api/uploads/sites/${sourceSiteId}/`, `/api/uploads/sites/${targetSiteId}/`);
}

function isSafeArchiveEntryPath(entryPath: string): boolean {
  if (!entryPath || entryPath.includes("\\") || entryPath.includes("\0")) return false;
  if (entryPath.startsWith("/") || path.isAbsolute(entryPath)) return false;
  const segments = entryPath.split("/");
  return segments.every((seg) => seg !== ".." && seg !== ".");
}

/** Maximum number of automatic pre-restore snapshots retained per site. */
const MAX_PRE_RESTORE_SNAPSHOTS = 5;

/** Media entry staged on disk before the database transaction is attempted. */
interface StagedMediaFile {
  relPath: string;
  tempPath: string;
  destPath: string;
  size: number;
}

/** Media file already moved into place, tracked so it can be rolled back. */
interface AppliedMediaFile {
  destPath: string;
  backupPath: string | null;
}

/**
 * Reads an entry's declared uncompressed size from the ZIP central directory.
 *
 * JSZip exposes the value on its internal data descriptor, which lets the importer
 * reject oversized archives before decompressing any media payload.
 *
 * @param entry - Loaded ZIP entry.
 * @returns Declared byte size, or `null` when metadata is unavailable.
 */
function getZipEntryUncompressedSize(entry: JSZip.JSZipObject): number | null {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === "number" && Number.isFinite(data.uncompressedSize)
    ? data.uncompressedSize
    : null;
}

async function removeDirectoryQuietly(dir: string): Promise<void> {
  try {
    await fs.rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of temporary restore directories.
  }
}

/**
 * Restores every media destination touched before a failed database transaction.
 *
 * @param applied - Files moved into their final destination.
 * @param backupRoot - Directory holding originals that were replaced.
 * @param stagingRoot - Directory holding remaining staged files.
 */
async function rollbackAppliedMedia(
  applied: AppliedMediaFile[],
  backupRoot: string,
  stagingRoot: string
): Promise<void> {
  for (const file of [...applied].reverse()) {
    try {
      await fs.rm(/*turbopackIgnore: true*/ file.destPath, { force: true });
      if (file.backupPath) {
        ensureDir(path.dirname(file.destPath));
        await fs.rename(/*turbopackIgnore: true*/ file.backupPath, file.destPath);
      }
    } catch {
      // Keep restoring remaining files even if one rollback step fails.
    }
  }
  await removeDirectoryQuietly(backupRoot);
  await removeDirectoryQuietly(stagingRoot);
}

/**
 * Deletes the oldest automatic pre-restore snapshots, keeping a bounded history.
 *
 * @param snapshotDir - Directory containing `.kotonoba-backup` safety snapshots.
 * @param siteKey - Filesystem-safe site identifier used in snapshot names.
 */
async function prunePreRestoreSnapshots(snapshotDir: string, siteKey: string): Promise<void> {
  try {
    const prefix = `pre-restore-${siteKey}-`;
    const names = (await fs.readdir(/*turbopackIgnore: true*/ snapshotDir)).filter(
      (name) => name.startsWith(prefix) && name.endsWith(".kotonoba-backup")
    );
    if (names.length <= MAX_PRE_RESTORE_SNAPSHOTS) return;

    const dated = await Promise.all(
      names.map(async (name) => {
        const fullPath = path.join(/*turbopackIgnore: true*/ snapshotDir, name);
        const stat = await fs.stat(/*turbopackIgnore: true*/ fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      })
    );

    dated.sort((a, b) => b.mtimeMs - a.mtimeMs);
    await Promise.all(
      dated.slice(MAX_PRE_RESTORE_SNAPSHOTS).map((entry) =>
        fs.unlink(/*turbopackIgnore: true*/ entry.fullPath)
      )
    );
  } catch {
    // Retention is best-effort and must never fail a successful restore.
  }
}

/**
 * Restores a tenant site's database records and media assets from an encrypted Kotonoba backup archive.
 * Enforces ZIP size/entry limits, manifest checksum checks, symlink/zip-slip guards, automatic
 * pre-replace snapshots, transactional SQLite writes, HTML/URL sanitization, and tenant media isolation.
 *
 * @param {Buffer} zipBuffer - Binary Buffer containing the `.kotonoba-backup` (or legacy `.zip`) archive.
 * @param {string} targetSiteId - Unique identifier of the tenant site receiving the restored data.
 * @param {RestoreOptions} options - Restoration options specifying mode (`'merge'` | `'replace'`) and fallback user.
 * @returns {Promise<RestoreResult>} Resolution result with restored entity counts or explicit failure reason.
 */
export async function restoreSiteBackupZip(
  zipBuffer: Buffer,
  targetSiteId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  const db = getDb();
  const envCfg = getEnvConfig();

  const targetSite = db.select().from(sites).where(eq(sites.id, targetSiteId)).get();
  if (!targetSite) {
    return {
      success: false,
      stats: emptyStats(),
      error: `Target site with ID "${targetSiteId}" does not exist.`,
    };
  }

  let archiveBuffer = zipBuffer;
  if (isEncryptedBackup(zipBuffer)) {
    try {
      archiveBuffer = decryptBackupArchive(zipBuffer);
    } catch (err) {
      return {
        success: false,
        stats: emptyStats(),
        error: err instanceof Error ? err.message : "Backup decryption failed.",
      };
    }
  } else if (!isLegacyBackupImportEnabled()) {
    return {
      success: false,
      stats: emptyStats(),
      error: "Unencrypted backups are disabled. Upload a .kotonoba-backup file.",
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archiveBuffer);
  } catch {
    return {
      success: false,
      stats: emptyStats(),
      error: "Invalid ZIP file format or corrupted archive.",
    };
  }

  const allEntryNames = Object.keys(zip.files);
  if (allEntryNames.length > envCfg.maxBackupFiles) {
    return {
      success: false,
      stats: emptyStats(),
      error: `Archive contains too many entries (${allEntryNames.length} > ${envCfg.maxBackupFiles}).`,
    };
  }

  for (const entryPath of allEntryNames) {
    const entryObj = zip.files[entryPath];
    if (!isSafeArchiveEntryPath(entryPath)) {
      return {
        success: false,
        stats: emptyStats(),
        error: `Unsafe archive entry path detected: ${entryPath}`,
      };
    }
    const unixMode = typeof entryObj.unixPermissions === "number" ? entryObj.unixPermissions : 0;
    if ((unixMode & 0o170000) === 0o120000) {
      return {
        success: false,
        stats: emptyStats(),
        error: `Symbolic links are not permitted in backup archives (${entryPath}).`,
      };
    }
  }

  const dataFile = zip.file("data.json");
  if (!dataFile) {
    return {
      success: false,
      stats: emptyStats(),
      error: "Archive does not contain a valid 'data.json' file.",
    };
  }

  const dataBuffer = await dataFile.async("nodebuffer");
  if (dataBuffer.length > envCfg.maxBackupJsonBytes) {
    return {
      success: false,
      stats: emptyStats(),
      error: "Backup data.json exceeds maximum permitted size.",
    };
  }

  const jsonStr = dataBuffer.toString("utf8");
  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    try {
      const manifestRaw = await manifestFile.async("string");
      const manifest = JSON.parse(manifestRaw) as Partial<BackupManifest>;
      if (manifest.format && manifest.format !== "kotonoba-backup") {
        return {
          success: false,
          stats: emptyStats(),
          error: "Unsupported backup manifest format.",
        };
      }
      if (manifest.checksum) {
        const actualDigest = crypto.createHash("sha256").update(jsonStr, "utf8").digest("hex");
        if (actualDigest !== manifest.checksum) {
          return {
            success: false,
            stats: emptyStats(),
            error: "Backup checksum verification failed; archive may be corrupted or altered.",
          };
        }
      }
    } catch {
      return {
        success: false,
        stats: emptyStats(),
        error: "Invalid manifest.json in backup archive.",
      };
    }
  }

  let rawData: BackupData;
  try {
    rawData = JSON.parse(jsonStr) as BackupData;
  } catch {
    return {
      success: false,
      stats: emptyStats(),
      error: "Failed to parse data.json from backup archive.",
    };
  }

  // Reject archives whose declared uncompressed size already exceeds the budget.
  let declaredUncompressedBytes = 0;
  for (const entryPath of allEntryNames) {
    const entry = zip.files[entryPath];
    if (!entry || entry.dir) continue;

    const declaredSize = getZipEntryUncompressedSize(entry);
    if (declaredSize === null) continue;
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
      return {
        success: false,
        stats: emptyStats(),
        error: `Invalid ZIP entry size metadata: ${entryPath}`,
      };
    }

    declaredUncompressedBytes += declaredSize;
    if (declaredUncompressedBytes > envCfg.maxBackupUncompressedBytes) {
      return {
        success: false,
        stats: emptyStats(),
        error: "Expanded backup archive exceeds maximum allowed uncompressed size.",
      };
    }
  }

  const uploadDir = getRuntimeUploadDir();
  const siteUploadDir = path.resolve(/*turbopackIgnore: true*/ uploadDir, "sites", targetSiteId);
  const sourceSiteId = rawData.site?.id;
  const stagingRoot = path.join(siteUploadDir, `.restore-staging-${crypto.randomUUID()}`);
  const backupRoot = path.join(siteUploadDir, `.restore-backup-${crypto.randomUUID()}`);
  const pendingMedia: Array<{ zipEntry: JSZip.JSZipObject; relPath: string; destPath: string }> = [];
  const seenDestinations = new Set<string>();

  for (const entryPath of allEntryNames) {
    const zipEntry = zip.files[entryPath];
    if (!zipEntry || zipEntry.dir || !entryPath.startsWith("uploads/")) continue;

    let relPath = entryPath.slice("uploads/".length).replace(/^\/+/, "");
    if (sourceSiteId && relPath.startsWith(`sites/${sourceSiteId}/`)) {
      relPath = relPath.slice(`sites/${sourceSiteId}/`.length);
    }
    if (!relPath || !isSafeArchiveEntryPath(relPath) || relPath.startsWith(".")) continue;

    const destPath = path.resolve(/*turbopackIgnore: true*/ siteUploadDir, relPath);
    if (!destPath.startsWith(siteUploadDir + path.sep)) {
      return {
        success: false,
        stats: emptyStats(),
        error: `Unsafe media destination path in backup: ${relPath}`,
      };
    }

    const destKey = process.platform === "win32" ? destPath.toLowerCase() : destPath;
    if (seenDestinations.has(destKey)) {
      return {
        success: false,
        stats: emptyStats(),
        error: `Duplicate media destination path in backup: ${relPath}`,
      };
    }
    seenDestinations.add(destKey);
    pendingMedia.push({ zipEntry, relPath, destPath });
  }

  // Create the automatic safety snapshot before staging or modifying any media.
  let snapshotPath: string | undefined;
  if (options.mode === "replace") {
    try {
      const snapshot = await createSiteBackupZip(targetSiteId);
      const snapshotDir = path.join(/*turbopackIgnore: true*/ path.dirname(envCfg.dbPath), "snapshots");
      ensureDir(snapshotDir);
      const siteKey = targetSiteId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "site";
      const filePath = path.join(
        /*turbopackIgnore: true*/ snapshotDir,
        `pre-restore-${siteKey}-${Date.now()}.kotonoba-backup`
      );
      await fs.writeFile(/*turbopackIgnore: true*/ filePath, snapshot.buffer);
      snapshotPath = filePath;
      await prunePreRestoreSnapshots(snapshotDir, siteKey);
    } catch {
      return {
        success: false,
        stats: emptyStats(),
        error: "Unable to create pre-restore safety snapshot before replace operation.",
      };
    }
  }

  // Stream every media entry to a temporary directory while enforcing actual sizes.
  const stagedMedia: StagedMediaFile[] = [];
  let actualMediaBytes = 0;

  try {
    for (const media of pendingMedia) {
      const tempPath = path.join(stagingRoot, media.relPath);
      ensureDir(path.dirname(tempPath));
      await pipeline(media.zipEntry.nodeStream("nodebuffer"), createWriteStream(tempPath));

      const stat = await fs.stat(/*turbopackIgnore: true*/ tempPath);
      if (!stat.isFile()) {
        throw new Error("Extracted media entry is not a regular file.");
      }

      actualMediaBytes += stat.size;
      if (dataBuffer.length + actualMediaBytes > envCfg.maxBackupUncompressedBytes) {
        throw new Error("EXPANDED_TOO_LARGE");
      }

      stagedMedia.push({
        relPath: media.relPath,
        tempPath,
        destPath: media.destPath,
        size: stat.size,
      });
    }
  } catch (err) {
    await removeDirectoryQuietly(stagingRoot);
    return {
      success: false,
      stats: emptyStats(),
      error:
        err instanceof Error && err.message === "EXPANDED_TOO_LARGE"
          ? "Expanded backup archive exceeds maximum allowed uncompressed size."
          : "Failed to extract backup media safely.",
    };
  }

  // Move media into place before the transaction; roll back if the transaction fails.
  const appliedMedia: AppliedMediaFile[] = [];
  try {
    for (const file of stagedMedia) {
      ensureDir(path.dirname(file.destPath));

      let backupPath: string | null = null;
      try {
        const existing = await fs.lstat(/*turbopackIgnore: true*/ file.destPath);
        if (existing.isDirectory() || existing.isSymbolicLink()) {
          throw new Error("Media destination conflicts with an existing directory or symlink.");
        }
        backupPath = path.join(backupRoot, file.relPath);
        ensureDir(path.dirname(backupPath));
        await fs.rename(/*turbopackIgnore: true*/ file.destPath, backupPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      await fs.rename(/*turbopackIgnore: true*/ file.tempPath, file.destPath);
      appliedMedia.push({ destPath: file.destPath, backupPath });
    }
  } catch {
    await rollbackAppliedMedia(appliedMedia, backupRoot, stagingRoot);
    return {
      success: false,
      stats: emptyStats(),
      error: "Failed to write restored media files; no changes were committed.",
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

  const stats = emptyStats();

  try {
    db.transaction((tx) => {
    if (options.mode === "replace") {
      tx.delete(analytics).where(eq(analytics.siteId, targetSiteId)).run();
      tx.delete(analyticsSegments).where(eq(analyticsSegments.siteId, targetSiteId)).run();
      tx.delete(pages).where(eq(pages.siteId, targetSiteId)).run();
      tx.delete(posts).where(eq(posts.siteId, targetSiteId)).run();
      tx.delete(categories).where(eq(categories.siteId, targetSiteId)).run();
      tx.delete(tags).where(eq(tags.siteId, targetSiteId)).run();
      tx.delete(settings).where(eq(settings.siteId, targetSiteId)).run();
    }

    if (rawData.site) {
      const s = rawData.site;
      tx.update(sites)
        .set({
          subtitle: s.subtitle !== undefined ? (s.subtitle || "") : targetSite.subtitle,
          description: s.description !== undefined ? (s.description || "") : targetSite.description,
          logoUrl:
            s.logoUrl !== undefined
              ? rewriteSiteMediaUrl(s.logoUrl, sourceSiteId, targetSiteId)
              : targetSite.logoUrl,
          faviconUrl:
            s.faviconUrl !== undefined
              ? rewriteSiteMediaUrl(s.faviconUrl, sourceSiteId, targetSiteId)
              : targetSite.faviconUrl,
          theme: s.theme === "light" || s.theme === "dark" ? s.theme : targetSite.theme,
          customCss: s.customCss !== undefined ? sanitizeCss(s.customCss) : targetSite.customCss,
          primaryColor: s.primaryColor || targetSite.primaryColor,
          fontFamily: s.fontFamily || targetSite.fontFamily,
          navLinks: s.navLinks ? sanitizeNavLinksJson(s.navLinks) : targetSite.navLinks,
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
      const existing = tx
        .select()
        .from(categories)
        .where(and(eq(categories.siteId, targetSiteId), eq(categories.slug, cat.slug)))
        .get();

      if (existing) {
        tx.update(categories)
          .set({
            name: cat.name,
            description: cat.description || "",
            sortOrder: typeof cat.sortOrder === "number" ? cat.sortOrder : 0,
          })
          .where(eq(categories.id, existing.id))
          .run();
        if (cat.id) categoryIdMap.set(cat.id, existing.id);
      } else {
        const existingById = cat.id ? tx.select({ id: categories.id }).from(categories).where(eq(categories.id, cat.id)).get() : null;
        const newId = cat.id && !existingById ? cat.id : generateId();
        tx.insert(categories)
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
      stats.categories++;
    }

    const tagIdMap = new Map<string, string>();
    for (const tag of importedTags) {
      if (!tag.name || !tag.slug) continue;
      const existing = tx
        .select()
        .from(tags)
        .where(and(eq(tags.siteId, targetSiteId), eq(tags.slug, tag.slug)))
        .get();

      if (existing) {
        if (tag.id) tagIdMap.set(tag.id, existing.id);
      } else {
        const existingById = tag.id ? tx.select({ id: tags.id }).from(tags).where(eq(tags.id, tag.id)).get() : null;
        const newId = tag.id && !existingById ? tag.id : generateId();
        tx.insert(tags)
          .values({
            id: newId,
            siteId: targetSiteId,
            name: tag.name,
            slug: tag.slug,
          })
          .run();
        if (tag.id) tagIdMap.set(tag.id, newId);
      }
      stats.tags++;
    }

    const allUsers = tx.select({ id: users.id }).from(users).all();
    const validUserIds = new Set(allUsers.map((u) => u.id));
    let fallbackUserId =
      options.currentUserId && validUserIds.has(options.currentUserId)
        ? options.currentUserId
        : allUsers[0]?.id || null;

    if (!fallbackUserId) {
      const defaultId = generateId();
      tx.insert(users)
        .values({
          id: defaultId,
          email: `admin@${targetSite.domain || "kotonoba.local"}`,
          passwordHash: "backup_restored_user",
          displayName: "Administrator",
          role: "super_admin",
          siteId: targetSiteId,
          tokenVersion: 1,
          createdAt: new Date(),
        })
        .run();
      fallbackUserId = defaultId;
      validUserIds.add(defaultId);
    }

    const postIdMap = new Map<string, string>();
    for (const post of importedPosts) {
      if (!post.title || !post.slug) continue;

      const authorId = post.authorId && validUserIds.has(post.authorId) ? post.authorId : fallbackUserId;
      const existingPost = tx
        .select()
        .from(posts)
        .where(and(eq(posts.siteId, targetSiteId), eq(posts.slug, post.slug)))
        .get();

      const postStatus =
        post.status === "published" || post.status === "archived" || post.status === "scheduled"
          ? post.status
          : "draft";
      const rewrittenMd = rewriteSiteMediaInBody(post.contentMd || "", sourceSiteId, targetSiteId);
      const rewrittenHtml = rewriteSiteMediaInBody(post.contentHtml || "", sourceSiteId, targetSiteId);
      const canonical = resolveCanonicalContent(rewrittenMd, rewrittenHtml, post.contentFormat);
      const safeCover = rewriteSiteMediaUrl(post.coverImage, sourceSiteId, targetSiteId);
      const safeShortUrl = post.shortUrl ? sanitizeUrl(post.shortUrl, { allowRelative: false }) : null;
      const locale = normalizeLocale(post.locale);

      let targetPostId: string;
      if (existingPost) {
        targetPostId = existingPost.id;
        tx.update(posts)
          .set({
            title: post.title,
            contentMd: canonical.contentMd,
            contentHtml: canonical.contentHtml,
            contentFormat: canonical.contentFormat,
            excerpt: post.excerpt || "",
            coverImage: safeCover,
            status: postStatus,
            locale,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            updatedAt: new Date(),
            views: typeof post.views === "number" ? post.views : 0,
            pinned: Boolean(post.pinned),
            shortUrl: safeShortUrl !== null ? safeShortUrl : existingPost.shortUrl,
            dubLinkId: post.dubLinkId !== undefined ? post.dubLinkId : existingPost.dubLinkId,
          })
          .where(eq(posts.id, existingPost.id))
          .run();

        tx.delete(postCategories).where(eq(postCategories.postId, existingPost.id)).run();
        tx.delete(postTags).where(eq(postTags.postId, existingPost.id)).run();
      } else {
        const existingById = post.id ? tx.select({ id: posts.id }).from(posts).where(eq(posts.id, post.id)).get() : null;
        targetPostId = post.id && !existingById ? post.id : generateId();
        tx.insert(posts)
          .values({
            id: targetPostId,
            siteId: targetSiteId,
            authorId,
            title: post.title,
            slug: post.slug,
            contentMd: canonical.contentMd,
            contentHtml: canonical.contentHtml,
            contentFormat: canonical.contentFormat,
            excerpt: post.excerpt || "",
            coverImage: safeCover,
            status: postStatus,
            locale,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
            updatedAt: new Date(),
            views: typeof post.views === "number" ? post.views : 0,
            pinned: Boolean(post.pinned),
            shortUrl: safeShortUrl,
            dubLinkId: post.dubLinkId || null,
          })
          .run();
      }

      if (post.id) postIdMap.set(post.id, targetPostId);

      const matchingPostCats = post.id ? importedPostCategories.filter((pc) => pc.postId === post.id) : [];
      for (const pc of matchingPostCats) {
        const mappedCatId = categoryIdMap.get(pc.categoryId);
        if (mappedCatId) {
          tx.insert(postCategories)
            .values({ postId: targetPostId, categoryId: mappedCatId })
            .onConflictDoNothing()
            .run();
        }
      }

      const matchingPostTags = post.id ? importedPostTags.filter((pt) => pt.postId === post.id) : [];
      for (const pt of matchingPostTags) {
        const mappedTagId = tagIdMap.get(pt.tagId);
        if (mappedTagId) {
          tx.insert(postTags)
            .values({ postId: targetPostId, tagId: mappedTagId })
            .onConflictDoNothing()
            .run();
        }
      }

      stats.posts++;
    }

    const pageIdMap = new Map<string, string>();
    for (const page of importedPages) {
      if (!page.title || !page.slug) continue;

      const authorId = page.authorId && validUserIds.has(page.authorId) ? page.authorId : fallbackUserId;
      const existingPage = tx
        .select()
        .from(pages)
        .where(and(eq(pages.siteId, targetSiteId), eq(pages.slug, page.slug)))
        .get();

      const pageStatus =
        page.status === "published" || page.status === "archived" || page.status === "scheduled"
          ? page.status
          : "draft";
      const rewrittenMd = rewriteSiteMediaInBody(page.contentMd || "", sourceSiteId, targetSiteId);
      const rewrittenHtml = rewriteSiteMediaInBody(page.contentHtml || "", sourceSiteId, targetSiteId);
      const canonical = resolveCanonicalContent(rewrittenMd, rewrittenHtml, page.contentFormat);
      const safeCover = rewriteSiteMediaUrl(page.coverImage, sourceSiteId, targetSiteId);
      const locale = normalizeLocale(page.locale);

      let targetPageId: string;
      if (existingPage) {
        targetPageId = existingPage.id;
        tx.update(pages)
          .set({
            title: page.title,
            contentMd: canonical.contentMd,
            contentHtml: canonical.contentHtml,
            contentFormat: canonical.contentFormat,
            excerpt: page.excerpt || "",
            coverImage: safeCover,
            status: pageStatus,
            locale,
            publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
            updatedAt: new Date(),
            views: typeof page.views === "number" ? page.views : 0,
          })
          .where(eq(pages.id, existingPage.id))
          .run();
      } else {
        const existingById = page.id ? tx.select({ id: pages.id }).from(pages).where(eq(pages.id, page.id)).get() : null;
        targetPageId = page.id && !existingById ? page.id : generateId();
        tx.insert(pages)
          .values({
            id: targetPageId,
            siteId: targetSiteId,
            authorId,
            title: page.title,
            slug: page.slug,
            contentMd: canonical.contentMd,
            contentHtml: canonical.contentHtml,
            contentFormat: canonical.contentFormat,
            excerpt: page.excerpt || "",
            coverImage: safeCover,
            status: pageStatus,
            locale,
            publishedAt: page.publishedAt ? new Date(page.publishedAt) : null,
            createdAt: page.createdAt ? new Date(page.createdAt) : new Date(),
            updatedAt: new Date(),
            views: typeof page.views === "number" ? page.views : 0,
          })
          .run();
      }

      if (page.id) pageIdMap.set(page.id, targetPageId);
      stats.pages++;
    }

    for (const s of importedSettings) {
      if (!s.key) continue;
      let storedValue = s.value || "";
      if (SECRET_SETTING_KEYS.has(s.key) && storedValue && !isEncryptedSecret(storedValue)) {
        storedValue = encryptSecret(storedValue);
      }

      const existing = tx
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, targetSiteId), eq(settings.key, s.key)))
        .get();

      if (existing) {
        tx.update(settings).set({ value: storedValue }).where(eq(settings.id, existing.id)).run();
      } else {
        tx.insert(settings)
          .values({
            siteId: targetSiteId,
            key: s.key,
            value: storedValue,
          })
          .run();
      }
      stats.settings++;
    }

    for (const seg of importedSegments) {
      if (!seg.name) continue;
      const existingSeg = tx
        .select()
        .from(analyticsSegments)
        .where(and(eq(analyticsSegments.siteId, targetSiteId), eq(analyticsSegments.name, seg.name)))
        .get();

      if (existingSeg) {
        tx.update(analyticsSegments)
          .set({ filters: seg.filters || "{}" })
          .where(eq(analyticsSegments.id, existingSeg.id))
          .run();
      } else {
        const existingById = seg.id
          ? tx.select({ id: analyticsSegments.id }).from(analyticsSegments).where(eq(analyticsSegments.id, seg.id)).get()
          : null;
        const targetSegId = seg.id && !existingById ? seg.id : generateId();
        tx.insert(analyticsSegments)
          .values({
            id: targetSegId,
            siteId: targetSiteId,
            name: seg.name,
            filters: seg.filters || "{}",
            createdAt: seg.createdAt ? new Date(seg.createdAt) : new Date(),
          })
          .run();
      }
      stats.analyticsSegments++;
    }

    for (const hit of importedAnalytics) {
      if (!hit.path) continue;

      const mappedPostId = hit.postId ? postIdMap.get(hit.postId) || hit.postId : null;
      const mappedPageId = hit.pageId ? pageIdMap.get(hit.pageId) || hit.pageId : null;

      const validPostId =
        mappedPostId &&
        tx
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.id, mappedPostId), eq(posts.siteId, targetSiteId)))
          .get()
          ? mappedPostId
          : null;
      const validPageId =
        mappedPageId &&
        tx
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.id, mappedPageId), eq(pages.siteId, targetSiteId)))
          .get()
          ? mappedPageId
          : null;

      try {
        tx.insert(analytics)
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
        stats.analytics++;
      } catch {
        // Skip invalid analytics records without aborting the entire restore transaction
      }
    }
    });
  } catch (err) {
    console.error(
      "[backup/import] Database transaction failed; restoring previous media:",
      err instanceof Error ? err.message : err
    );
    await rollbackAppliedMedia(appliedMedia, backupRoot, stagingRoot);
    return {
      success: false,
      stats: emptyStats(),
      error: "Failed to restore backup transaction; no database or media changes were committed.",
    };
  }

  await removeDirectoryQuietly(stagingRoot);
  await removeDirectoryQuietly(backupRoot);
  stats.media = stagedMedia.length;

  return {
    success: true,
    stats,
    snapshotPath,
  };
}
