import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { MEDIA_PAGE_SIZE } from "@/lib/config/constants";
import { collectReferencedMediaPaths } from "@/lib/queries/media";
import { getS3Client, getStorageConfig } from "./config";
import { deleteFromStorage } from "./objects";
import { isObjectStorageConfigured, resolveContainedLocalPath, sanitizePath, scopeStoragePath, unscopeStoragePath } from "./paths";
import type { MediaFileItem, MediaFolderItem, MediaListingResult, OrphanCleanupResult, StorageConfig } from "./types";

interface StoredObjectDescriptor {
  physicalPath: string;
  logicalPath: string;
  size: number;
  mtimeMs: number;
}

function getParentFolderPath(cleanLogicalFolder: string): string | null {
  if (!cleanLogicalFolder) return null;
  const segments = cleanLogicalFolder.split("/");
  segments.pop();
  return segments.join("/");
}

async function listS3FolderPage(
  config: StorageConfig,
  scopedFolder: string,
  cleanLogicalFolder: string,
  parentFolder: string | null,
  pageLimit: number,
  siteId?: string,
  cursor?: string
): Promise<MediaListingResult> {
  try {
    const res = await getS3Client(config).send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: scopedFolder ? `${scopedFolder}/` : "",
        Delimiter: "/",
        MaxKeys: pageLimit,
        ContinuationToken: cursor,
      })
    );

    const folders: MediaFolderItem[] = (res.CommonPrefixes || []).map((cp) => {
      const folderFullPath = sanitizePath(cp.Prefix || "");
      return { name: path.basename(folderFullPath), path: unscopeStoragePath(folderFullPath, siteId) };
    });

    const publicUrlBase = config.publicUrl;
    const files: MediaFileItem[] = (res.Contents || [])
      .filter((obj) => obj.Key && !obj.Key.endsWith("/") && !obj.Key.endsWith(".keep"))
      .map((obj) => {
        const physicalPath = obj.Key!;
        const url =
          publicUrlBase && !publicUrlBase.includes("r2.cloudflarestorage.com")
            ? `${publicUrlBase}/${physicalPath}`
            : `/api/uploads/${physicalPath}`;
        return {
          filename: path.basename(physicalPath),
          path: unscopeStoragePath(physicalPath, siteId),
          url,
          size: obj.Size || 0,
          updatedAt: obj.LastModified || new Date(),
          folder: cleanLogicalFolder,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      currentFolder: cleanLogicalFolder,
      parentFolder,
      folders,
      files,
      nextCursor: res.IsTruncated ? res.NextContinuationToken ?? null : null,
    };
  } catch (err) {
    console.error("[media] S3/R2 listObjects failed:", err instanceof Error ? err.message : err);
    throw err;
  }
}

async function listLocalFolderPage(
  uploadDir: string,
  scopedFolder: string,
  cleanLogicalFolder: string,
  parentFolder: string | null,
  pageLimit: number,
  rawCursor?: string
): Promise<MediaListingResult> {
  const currentDir = resolveContainedLocalPath(uploadDir, scopedFolder);
  if (!existsSync(currentDir)) {
    return { currentFolder: cleanLogicalFolder, parentFolder, folders: [], files: [], nextCursor: null };
  }

  try {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    const folders: MediaFolderItem[] = [];
    const files: MediaFileItem[] = [];

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        folders.push({ name: entry.name, path: cleanLogicalFolder ? `${cleanLogicalFolder}/${entry.name}` : entry.name });
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        const stat = await fs.stat(path.join(currentDir, entry.name));
        const relativeLogical = cleanLogicalFolder ? `${cleanLogicalFolder}/${entry.name}` : entry.name;
        const physicalFilePath = scopedFolder ? `${scopedFolder}/${entry.name}` : entry.name;
        files.push({
          filename: entry.name,
          path: relativeLogical,
          url: `/api/uploads/${physicalFilePath}`,
          size: stat.size,
          updatedAt: stat.mtime,
          folder: cleanLogicalFolder,
        });
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.filename.localeCompare(b.filename));

    const parsedOffset = rawCursor ? Number.parseInt(rawCursor, 10) : 0;
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const slicedFiles = files.slice(offset, offset + pageLimit);
    const nextOffset = offset + slicedFiles.length;

    return {
      currentFolder: cleanLogicalFolder,
      parentFolder,
      folders,
      files: slicedFiles,
      nextCursor: nextOffset < files.length ? String(nextOffset) : null,
    };
  } catch {
    return { currentFolder: cleanLogicalFolder, parentFolder, folders: [], files: [], nextCursor: null };
  }
}

/** Retrieves cursor-paginated folder contents scoped to the tenant workspace. */
export async function listMediaFiles(
  folder = "",
  siteId?: string,
  options?: { cursor?: string | null; limit?: number }
): Promise<MediaListingResult> {
  const cleanLogicalFolder = unscopeStoragePath(sanitizePath(folder), siteId);
  const scopedFolder = scopeStoragePath(cleanLogicalFolder, siteId);
  const config = getStorageConfig(siteId);
  const pageLimit = Math.max(1, Math.min(options?.limit ?? MEDIA_PAGE_SIZE, 200));
  const rawCursor = options?.cursor?.trim() || undefined;
  const parentFolder = getParentFolderPath(cleanLogicalFolder);

  if (isObjectStorageConfigured(config)) {
    return listS3FolderPage(config, scopedFolder, cleanLogicalFolder, parentFolder, pageLimit, siteId, rawCursor);
  }
  return listLocalFolderPage(config.uploadDir, scopedFolder, cleanLogicalFolder, parentFolder, pageLimit, rawCursor);
}

async function listAllTenantObjects(siteId: string): Promise<StoredObjectDescriptor[]> {
  const config = getStorageConfig(siteId);
  const objects: StoredObjectDescriptor[] = [];

  if (isObjectStorageConfigured(config)) {
    try {
      const s3 = getS3Client(config);
      let continuationToken: string | undefined;
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: `sites/${siteId}/`, ContinuationToken: continuationToken }));
        for (const obj of res.Contents || []) {
          if (!obj.Key || obj.Key.endsWith("/") || obj.Key.endsWith(".keep")) continue;
          const normalized = sanitizePath(obj.Key);
          objects.push({
            physicalPath: normalized,
            logicalPath: unscopeStoragePath(normalized, siteId),
            size: obj.Size || 0,
            mtimeMs: obj.LastModified ? obj.LastModified.getTime() : 0,
          });
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch {
      return objects;
    }
    return objects;
  }

  const rootDir = resolveContainedLocalPath(config.uploadDir, `sites/${siteId}`);
  if (!existsSync(rootDir)) return objects;

  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        const rel = sanitizePath(path.relative(rootDir, fullPath));
        objects.push({ physicalPath: `sites/${siteId}/${rel}`, logicalPath: rel, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  await walk(rootDir);
  return objects;
}

/** Calculates total storage bytes consumed by media assets under `sites/<siteId>/`. */
export async function getSiteStorageUsageBytes(siteId: string): Promise<number> {
  if (!siteId) return 0;
  const objects = await listAllTenantObjects(siteId);
  return objects.reduce((sum, item) => sum + item.size, 0);
}

/** Deletes tenant-scoped media files unreferenced in DB whose age exceeds `gracePeriodMs`. */
export async function cleanupOrphanMedia(
  siteId: string,
  options: { gracePeriodMs?: number } = {}
): Promise<OrphanCleanupResult> {
  if (!siteId) return { deletedCount: 0, freedBytes: 0, deletedPaths: [] };

  const gracePeriodMs = options.gracePeriodMs ?? 60_000;
  const cutoffMs = Date.now() - Math.max(0, gracePeriodMs);
  const referenced = collectReferencedMediaPaths(siteId);
  const objects = await listAllTenantObjects(siteId);

  const deletedPaths: string[] = [];
  let freedBytes = 0;

  for (const obj of objects) {
    if (obj.mtimeMs > cutoffMs) continue;
    if (referenced.has(obj.physicalPath) || referenced.has(obj.logicalPath)) continue;
    if (await deleteFromStorage(obj.logicalPath, false, siteId)) {
      deletedPaths.push(obj.logicalPath);
      freedBytes += obj.size;
    }
  }

  return { deletedCount: deletedPaths.length, freedBytes, deletedPaths };
}
