import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { Readable } from "stream";
import { ensureDir } from "@/lib/utils/fs";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getDb } from "@/lib/db";
import { pages, posts, settings, sites, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecretOrLegacyPlaintext } from "@/lib/security/crypto";
import { getRuntimeUploadDir, getStorageEnvCredentials } from "@/lib/config/env";

/**
 * Storage configuration interface holding resolved driver and authentication parameters.
 */
export interface StorageConfig {
  /** Selected driver backend. */
  provider: "local" | "s3" | "r2";
  /** Cloud storage bucket name. */
  bucket?: string;
  /** Cloud region identifier. */
  region?: string;
  /** Custom endpoint URL for Cloudflare R2 or MinIO. */
  endpoint?: string;
  /** Access Key ID credential. */
  accessKeyId?: string;
  /** Secret Access Key credential. */
  secretAccessKey?: string;
  /** Public base URL for serving media assets. */
  publicUrl?: string;
  /** Local filesystem directory path for persistent uploads. */
  uploadDir: string;
}

/**
 * Metadata record for a stored media file.
 */
export interface MediaFileItem {
  /** Base filename. */
  filename: string;
  /** Relative path within the storage bucket or uploads directory. */
  path: string;
  /** Public or presigned accessible HTTP URL. */
  url: string;
  /** File size in bytes. */
  size: number;
  /** Last modification timestamp. */
  updatedAt: Date;
  /** Containing directory folder path. */
  folder: string;
}

/**
 * Directory folder structure representation.
 */
export interface MediaFolderItem {
  /** Directory display name. */
  name: string;
  /** Normalized path relative to storage root. */
  path: string;
}

/**
 * File upload completion result payload.
 */
export interface UploadResult {
  /** Accessible HTTP URL for the uploaded asset. */
  url: string;
  /** Sanitized base filename. */
  filename: string;
  /** Relative storage path. */
  path: string;
  /** Uploaded file size in bytes. */
  size: number;
  /** MIME content-type string. */
  mimeType: string;
}

/**
 * Directory listing payload containing subfolders and files.
 */
export interface MediaListingResult {
  /** Current active directory path. */
  currentFolder: string;
  /** Parent directory path or null if at root. */
  parentFolder: string | null;
  /** List of subdirectories. */
  folders: MediaFolderItem[];
  /** List of media file items. */
  files: MediaFileItem[];
}

/**
 * Dynamically resolves the active storage configuration for a given tenant site.
 * Inspects SQLite settings for custom S3/R2 credentials, falling back to environment variables and local disk.
 *
 * @param siteId - Optional site identifier to retrieve site-specific storage settings.
 * @returns Resolved StorageConfig object.
 */
export function getStorageConfig(siteId?: string): StorageConfig {
  const uploadDir = getRuntimeUploadDir();
  ensureDir(uploadDir);

  const {
    r2AccountId: R2_ACCOUNT_ID,
    r2AccessKeyId: R2_ACCESS_KEY_ID,
    r2SecretAccessKey: R2_SECRET_ACCESS_KEY,
    r2BucketName: R2_BUCKET_NAME,
    r2PublicUrl: R2_PUBLIC_URL,
    s3Bucket: S3_BUCKET,
    awsAccessKeyId: AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
    awsRegion: AWS_REGION,
  } = getStorageEnvCredentials();

  try {
    const db = getDb();
    let targetSiteId = siteId;

    if (!targetSiteId) {
      const firstSite = db.select({ id: sites.id }).from(sites).limit(1).get();
      targetSiteId = firstSite?.id;
    }

    if (targetSiteId) {
      const siteSettings = db
        .select()
        .from(settings)
        .where(eq(settings.siteId, targetSiteId))
        .all();

      const map: Record<string, string> = {};
      for (const s of siteSettings) {
        map[s.key] = s.value;
      }

      let provider = (map.storage_provider as "local" | "s3" | "r2") || undefined;

      // Auto-detect provider if not explicitly saved in DB
      if (!provider) {
        if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
          provider = "r2";
        } else if (S3_BUCKET && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
          provider = "s3";
        } else {
          provider = "local";
        }
      }

      if (provider === "r2" || provider === "s3") {
        const bucket = map.s3_bucket || R2_BUCKET_NAME || S3_BUCKET || "";
        const region = map.s3_region || AWS_REGION || "auto";
        const endpoint =
          map.s3_endpoint ||
          (provider === "r2" && R2_ACCOUNT_ID
            ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined);
        const accessKeyId =
          map.s3_access_key || R2_ACCESS_KEY_ID || AWS_ACCESS_KEY_ID || "";
        const rawSecretKey = map.s3_secret_key ? decryptSecretOrLegacyPlaintext(map.s3_secret_key) : "";
        const secretAccessKey =
          rawSecretKey || R2_SECRET_ACCESS_KEY || AWS_SECRET_ACCESS_KEY || "";
        const publicUrl = (map.s3_public_url || R2_PUBLIC_URL || "").replace(/\/$/, "");

        if (bucket && accessKeyId && secretAccessKey) {
          return {
            provider,
            bucket,
            region,
            endpoint,
            accessKeyId,
            secretAccessKey,
            publicUrl: publicUrl || undefined,
            uploadDir,
          };
        }
      }
    }
  } catch {}

  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
    return {
      provider: "r2",
      bucket: R2_BUCKET_NAME,
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      publicUrl: (R2_PUBLIC_URL || "").replace(/\/$/, "") || undefined,
      uploadDir,
    };
  }

  if (S3_BUCKET && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return {
      provider: "s3",
      bucket: S3_BUCKET,
      region: AWS_REGION || "us-east-1",
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      uploadDir,
    };
  }

  return {
    provider: "local",
    publicUrl: "/api/uploads",
    uploadDir,
  };
}

/**
 * Instantiates an AWS SDK S3Client configured with the provided storage settings.
 *
 * @param config - The resolved StorageConfig parameters.
 * @returns Configured S3Client instance.
 */
export function getS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  });
}

/**
 * Returns a summary of current storage driver status for administrative inspection.
 *
 * @param siteId - Optional site identifier.
 * @returns Object summarizing provider name, bucket name, upload directory, and public CDN base URL.
 */
export function getStorageStatus(siteId?: string) {
  const config = getStorageConfig(siteId);
  return {
    provider: config.provider,
    bucketName: config.bucket,
    uploadDir: config.provider === "local" ? config.uploadDir : undefined,
    publicUrl: config.publicUrl,
  };
}

const MEDIA_MIME_MAP: Record<string, string> = {
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Resolves an allowlisted Content-Type from asset extension to prevent MIME spoofing on uploads.
 *
 * @param filePath - Relative object key or filename.
 * @returns Allowlisted MIME content-type string.
 */
export function getSafeMediaContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MEDIA_MIME_MAP[ext] || "application/octet-stream";
}

/**
 * Builds standard MIME, caching, nosniff, and SVG sandbox response headers for a resolved media asset.
 *
 * @param asset - Resolved media asset payload and metadata.
 * @param cacheControl - Cache-Control header directive for the serving endpoint.
 * @returns HTTP headers map suitable for `NextResponse`.
 */
export function buildMediaAssetHeaders(
  asset: Extract<StoredMediaReadResult, { status: "ok" }>,
  cacheControl = "public, max-age=31536000, immutable"
): Record<string, string> {
  const isSvg = asset.contentType === "image/svg+xml";
  return {
    "Content-Type": asset.contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    ...(asset.contentLength !== undefined
      ? { "Content-Length": String(asset.contentLength) }
      : {}),
    ...(asset.etag ? { ETag: asset.etag } : {}),
    ...(isSvg
      ? {
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "Content-Disposition": "inline",
        }
      : {}),
  };
}

/**
 * Result returned when loading a stored media object for direct HTTP streaming.
 */
export type StoredMediaReadResult =
  | {
      status: "ok";
      body: ReadableStream<Uint8Array> | Buffer;
      contentType: string;
      contentLength?: number;
      etag?: string;
    }
  | {
      status: "not-modified";
      etag?: string;
    }
  | {
      status: "not-found";
    };

async function toWebStreamOrBuffer(body: unknown): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ReadableStream) return body as ReadableStream<Uint8Array>;
  if (
    typeof (body as { transformToWebStream?: () => ReadableStream<Uint8Array> })
      .transformToWebStream === "function"
  ) {
    return (
      body as { transformToWebStream: () => ReadableStream<Uint8Array> }
    ).transformToWebStream();
  }
  if (typeof (body as { pipe?: unknown }).pipe === "function") {
    return Readable.toWeb(body as Readable) as unknown as ReadableStream<Uint8Array>;
  }
  if (
    typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }
  return null;
}

/**
 * Reads or streams a media asset directly from R2/S3 or local disk so callers serve `/api/uploads/*`
 * on the active site origin without issuing 307 redirects to external bucket URLs.
 *
 * @param relativePath - Validated storage-relative asset path (e.g. `sites/<siteId>/covers/a.png`).
 * @param options - Optional tenant identifier and conditional `If-None-Match` ETag header.
 * @returns Streamable object payload, `not-modified` marker, or `not-found`.
 */
export async function readStoredMediaObject(
  relativePath: string,
  options: { siteId?: string; ifNoneMatch?: string | null } = {}
): Promise<StoredMediaReadResult> {
  const cleanRelative = sanitizePath(relativePath);
  if (
    !cleanRelative ||
    cleanRelative.split("/").some((segment) => segment.startsWith("."))
  ) {
    return { status: "not-found" };
  }

  const config = getStorageConfig(options.siteId);
  const contentType = getSafeMediaContentType(cleanRelative);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: cleanRelative,
          ...(options.ifNoneMatch ? { IfNoneMatch: options.ifNoneMatch } : {}),
        })
      );

      const body = await toWebStreamOrBuffer(res.Body);
      if (!body) {
        return { status: "not-found" };
      }

      return {
        status: "ok",
        body,
        contentType,
        contentLength: typeof res.ContentLength === "number" ? res.ContentLength : undefined,
        etag: res.ETag,
      };
    } catch (error) {
      const metaStatus = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      const errName = (error as { name?: string })?.name;
      if (metaStatus === 304 || errName === "NotModified") {
        return {
          status: "not-modified",
          etag: options.ifNoneMatch || undefined,
        };
      }
      if (metaStatus === 404 || errName === "NoSuchKey" || errName === "NotFound") {
        return { status: "not-found" };
      }
      throw error;
    }
  }

  let filePath: string;
  try {
    filePath = resolveContainedLocalPath(config.uploadDir, cleanRelative);
  } catch {
    return { status: "not-found" };
  }

  const uploadRoot = path.resolve(/*turbopackIgnore: true*/ config.uploadDir);
  if (filePath === uploadRoot || !filePath.startsWith(uploadRoot + path.sep)) {
    return { status: "not-found" };
  }

  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return { status: "not-found" };
  }

  const [realRoot, realFile] = await Promise.all([
    fs.realpath(/*turbopackIgnore: true*/ uploadRoot),
    fs.realpath(/*turbopackIgnore: true*/ filePath),
  ]);
  if (!realFile.startsWith(realRoot + path.sep)) {
    return { status: "not-found" };
  }

  const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ realFile);
  return {
    status: "ok",
    body: fileBuffer,
    contentType: getSafeMediaContentType(realFile),
    contentLength: fileBuffer.byteLength,
  };
}

/**
 * Sanitizes a path string by removing backslashes, leading/trailing slashes, and traversal sequences.
 *
 * @param p - Raw path string.
 * @returns Sanitized relative path string.
 */
export function sanitizePath(p: string): string {
  const normalized = p.replace(/\\/g, "/").replaceAll("\0", "");
  const segments = normalized
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..");
  return segments.join("/");
}

/**
 * Resolves a logical media path into a tenant-scoped relative storage key (`sites/<siteId>/...`)
 * and blocks cross-tenant access attempts targeting another `sites/<otherSiteId>` prefix.
 */
function scopeStoragePath(logicalPath: string, siteId?: string): string {
  const clean = sanitizePath(logicalPath);
  if (!siteId) return clean;

  const tenantPrefix = `sites/${siteId}`;
  if (!clean || clean === "sites") return tenantPrefix;
  if (clean === tenantPrefix || clean.startsWith(`${tenantPrefix}/`)) {
    return clean;
  }
  if (clean.startsWith("sites/")) {
    throw new Error("FORBIDDEN_MEDIA_PATH");
  }
  return `${tenantPrefix}/${clean}`;
}

function unscopeStoragePath(physicalPath: string, siteId?: string): string {
  const clean = sanitizePath(physicalPath);
  if (!siteId) return clean;
  const tenantPrefix = `sites/${siteId}`;
  if (clean === tenantPrefix) return "";
  if (clean.startsWith(`${tenantPrefix}/`)) {
    return clean.slice(tenantPrefix.length + 1);
  }
  return clean;
}

function resolveContainedLocalPath(uploadDir: string, relativePath: string): string {
  const root = path.resolve(/*turbopackIgnore: true*/ uploadDir);
  const resolved = relativePath
    ? path.resolve(/*turbopackIgnore: true*/ root, relativePath)
    : root;
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("INVALID_MEDIA_PATH");
  }
  return resolved;
}

/**
 * Uploads a file buffer to the active storage provider (Cloudflare R2, AWS S3, or local filesystem).
 *
 * @param buffer - File data buffer.
 * @param originalFilename - Name of the uploaded file to preserve extension.
 * @param contentType - MIME type of the file.
 * @param targetFolder - Optional subfolder path within storage. Defaults to root.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to an UploadResult containing public URL and asset metadata.
 */
export async function uploadToStorage(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  targetFolder = "",
  siteId?: string
): Promise<UploadResult> {
  const config = getStorageConfig(siteId);
  const cleanFolder = sanitizePath(targetFolder);
  if (siteId && cleanFolder.startsWith("sites/") && !cleanFolder.startsWith(`sites/${siteId}`)) {
    throw new Error("FORBIDDEN_MEDIA_PATH");
  }

  const ext = path.extname(originalFilename).toLowerCase();
  const baseName =
    path
      .basename(originalFilename, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "asset";

  const timestamp = Date.now();
  const rawFilename = `${baseName}-${timestamp}${ext}`;
  const scopedBase = scopeStoragePath(cleanFolder, siteId);
  const physicalPath = scopedBase ? `${scopedBase}/${rawFilename}` : rawFilename;
  const logicalPath = unscopeStoragePath(physicalPath, siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    const s3 = getS3Client(config);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: physicalPath,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);

    let fileUrl: string;
    if (config.publicUrl && !config.publicUrl.includes("r2.cloudflarestorage.com")) {
      fileUrl = `${config.publicUrl}/${physicalPath}`;
    } else {
      fileUrl = `/api/uploads/${physicalPath}`;
    }

    return {
      url: fileUrl,
      filename: rawFilename,
      path: logicalPath,
      size: buffer.length,
      mimeType: contentType,
    };
  }

  const destinationPath = resolveContainedLocalPath(config.uploadDir, physicalPath);
  ensureDir(path.dirname(destinationPath));
  await fs.writeFile(/*turbopackIgnore: true*/ destinationPath, buffer);

  return {
    url: `/api/uploads/${physicalPath}`,
    filename: rawFilename,
    path: logicalPath,
    size: buffer.length,
    mimeType: contentType,
  };
}

/**
 * Creates a new directory folder inside storage.
 *
 * @param folderName - New folder name.
 * @param parentFolder - Parent directory path.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to true on successful creation, false otherwise.
 */
export async function createFolder(
  folderName: string,
  parentFolder = "",
  siteId?: string
): Promise<boolean> {
  const cleanParent = sanitizePath(parentFolder);
  const cleanName = folderName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanName || cleanName === "sites") return false;
  const logicalFolder = cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
  const folderPath = scopeStoragePath(logicalFolder, siteId);

  const config = getStorageConfig(siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: `${folderPath}/.keep`,
          Body: Buffer.from(""),
          ContentType: "application/x-directory",
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  try {
    const fullPath = resolveContainedLocalPath(config.uploadDir, folderPath);
    ensureDir(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves or renames a stored media file into a target destination directory.
 *
 * @param itemPath - Current relative path of the item.
 * @param targetFolder - Target directory path.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to true on successful relocation, false otherwise.
 */
export async function moveMediaItem(
  itemPath: string,
  targetFolder: string,
  siteId?: string
): Promise<boolean> {
  let cleanItem: string;
  let scopedTarget: string;
  try {
    cleanItem = scopeStoragePath(itemPath, siteId);
    scopedTarget = scopeStoragePath(targetFolder, siteId);
  } catch {
    return false;
  }
  const filename = path.basename(cleanItem);
  if (!filename) return false;
  const newPath = scopedTarget ? `${scopedTarget}/${filename}` : filename;

  if (cleanItem === newPath) return true;

  const config = getStorageConfig(siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);

      await s3.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          CopySource: `${config.bucket}/${cleanItem}`,
          Key: newPath,
        })
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: cleanItem,
        })
      );

      return true;
    } catch {
      return false;
    }
  }

  try {
    const sourceFullPath = resolveContainedLocalPath(config.uploadDir, cleanItem);
    const targetDir = resolveContainedLocalPath(config.uploadDir, scopedTarget);
    ensureDir(targetDir);
    const destFullPath = path.join(targetDir, filename);

    if (existsSync(sourceFullPath)) {
      await fs.rename(sourceFullPath, destFullPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Deletes a file or directory from the active storage backend.
 *
 * @param itemPath - Relative path of the file or directory to remove.
 * @param isFolder - Boolean flag indicating if the target is a folder directory.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to true on successful deletion, false otherwise.
 */
export async function deleteFromStorage(
  itemPath: string,
  isFolder = false,
  siteId?: string
): Promise<boolean> {
  let scopedItem: string;
  try {
    scopedItem = scopeStoragePath(itemPath, siteId);
  } catch {
    return false;
  }
  if (!scopedItem || (siteId && scopedItem === `sites/${siteId}`)) return false;

  const config = getStorageConfig(siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);

      if (isFolder) {
        const prefix = `${scopedItem}/`;
        const listRes = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
          })
        );

        if (listRes.Contents && listRes.Contents.length > 0) {
          for (const obj of listRes.Contents) {
            if (obj.Key) {
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: config.bucket,
                  Key: obj.Key,
                })
              );
            }
          }
        }
      } else {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: scopedItem,
          })
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  try {
    const fullPath = resolveContainedLocalPath(config.uploadDir, scopedItem);
    if (!existsSync(fullPath)) return false;

    if (isFolder) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves the directory contents (folders and media files) for a specific folder path.
 *
 * @param folder - Subfolder directory path. Defaults to root.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to MediaListingResult.
 */
export async function listMediaFiles(
  folder = "",
  siteId?: string
): Promise<MediaListingResult> {
  const cleanLogicalFolder = unscopeStoragePath(sanitizePath(folder), siteId);
  const scopedFolder = scopeStoragePath(cleanLogicalFolder, siteId);
  const config = getStorageConfig(siteId);

  let parentFolder: string | null = null;
  if (cleanLogicalFolder) {
    const segments = cleanLogicalFolder.split("/");
    segments.pop();
    parentFolder = segments.join("/");
  }

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      const prefix = scopedFolder ? `${scopedFolder}/` : "";

      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix,
          Delimiter: "/",
          MaxKeys: 200,
        })
      );

      const folders: MediaFolderItem[] = (res.CommonPrefixes || []).map((cp) => {
        const folderFullPath = sanitizePath(cp.Prefix || "");
        const folderName = path.basename(folderFullPath);
        return {
          name: folderName,
          path: unscopeStoragePath(folderFullPath, siteId),
        };
      });

      const publicUrlBase = config.publicUrl;

      const files: MediaFileItem[] = await Promise.all(
        (res.Contents || [])
          .filter((obj) => obj.Key && !obj.Key.endsWith("/") && !obj.Key.endsWith(".keep"))
          .map(async (obj) => {
            const physicalPath = obj.Key!;
            const filename = path.basename(physicalPath);

            let url: string;
            if (publicUrlBase && !publicUrlBase.includes("r2.cloudflarestorage.com")) {
              url = `${publicUrlBase}/${physicalPath}`;
            } else {
              url = `/api/uploads/${physicalPath}`;
            }

            return {
              filename,
              path: unscopeStoragePath(physicalPath, siteId),
              url,
              size: obj.Size || 0,
              updatedAt: obj.LastModified || new Date(),
              folder: cleanLogicalFolder,
            };
          })
      );

      return {
        currentFolder: cleanLogicalFolder,
        parentFolder,
        folders,
        files: files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      };
    } catch {
      return { currentFolder: cleanLogicalFolder, parentFolder, folders: [], files: [] };
    }
  }

  const currentDir = resolveContainedLocalPath(config.uploadDir, scopedFolder);

  if (!existsSync(currentDir)) {
    return { currentFolder: cleanLogicalFolder, parentFolder, folders: [], files: [] };
  }

  try {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    const folders: MediaFolderItem[] = [];
    const files: MediaFileItem[] = [];

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        const subLogicalPath = cleanLogicalFolder ? `${cleanLogicalFolder}/${entry.name}` : entry.name;
        folders.push({
          name: entry.name,
          path: subLogicalPath,
        });
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        const fileFullPath = path.join(currentDir, entry.name);
        const stat = await fs.stat(fileFullPath);
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

    return {
      currentFolder: cleanLogicalFolder,
      parentFolder,
      folders,
      files: files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    };
  } catch {
    return { currentFolder: cleanLogicalFolder, parentFolder, folders: [], files: [] };
  }
}

interface StoredObjectDescriptor {
  physicalPath: string;
  logicalPath: string;
  size: number;
  mtimeMs: number;
}

async function listAllTenantObjects(siteId: string): Promise<{
  config: StorageConfig;
  objects: StoredObjectDescriptor[];
}> {
  const config = getStorageConfig(siteId);
  const tenantPrefix = `sites/${siteId}/`;
  const objects: StoredObjectDescriptor[] = [];

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      let continuationToken: string | undefined;
      do {
        const res = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: tenantPrefix,
            ContinuationToken: continuationToken,
          })
        );
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
      return { config, objects };
    }
    return { config, objects };
  }

  const rootDir = resolveContainedLocalPath(config.uploadDir, `sites/${siteId}`);
  if (!existsSync(rootDir)) {
    return { config, objects };
  }

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        const rel = sanitizePath(path.relative(rootDir, fullPath));
        objects.push({
          physicalPath: `sites/${siteId}/${rel}`,
          logicalPath: rel,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }

  await walk(rootDir);
  return { config, objects };
}

/**
 * Calculates total storage bytes currently consumed by media assets under a tenant prefix (`sites/<siteId>/`).
 *
 * @param siteId - Tenant site identifier.
 * @returns Total byte usage across all stored files for the tenant.
 */
export async function getSiteStorageUsageBytes(siteId: string): Promise<number> {
  if (!siteId) return 0;
  const { objects } = await listAllTenantObjects(siteId);
  return objects.reduce((sum, item) => sum + item.size, 0);
}

function collectReferencedMediaPaths(siteId: string): Set<string> {
  const referenced = new Set<string>();
  const db = getDb();

  const recordText = (value?: string | null) => {
    if (!value) return;
    const regex = /(?:\/api)?\/uploads\/([^\s"'`<>)?#]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      if (!match[1]) continue;
      try {
        const decoded = sanitizePath(decodeURIComponent(match[1]));
        referenced.add(decoded);
        referenced.add(unscopeStoragePath(decoded, siteId));
      } catch {
        const raw = sanitizePath(match[1]);
        referenced.add(raw);
        referenced.add(unscopeStoragePath(raw, siteId));
      }
    }
  };

  const siteRow = db
    .select({ logoUrl: sites.logoUrl, faviconUrl: sites.faviconUrl })
    .from(sites)
    .where(eq(sites.id, siteId))
    .get();
  if (siteRow) {
    recordText(siteRow.logoUrl);
    recordText(siteRow.faviconUrl);
  }

  const userRows = db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.siteId, siteId))
    .all();
  for (const row of userRows) {
    recordText(row.avatarUrl);
  }

  const postRows = db
    .select({
      coverImage: posts.coverImage,
      contentHtml: posts.contentHtml,
      contentMd: posts.contentMd,
    })
    .from(posts)
    .where(eq(posts.siteId, siteId))
    .all();
  for (const row of postRows) {
    recordText(row.coverImage);
    recordText(row.contentHtml);
    recordText(row.contentMd);
  }

  const pageRows = db
    .select({
      coverImage: pages.coverImage,
      contentHtml: pages.contentHtml,
      contentMd: pages.contentMd,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .all();
  for (const row of pageRows) {
    recordText(row.coverImage);
    recordText(row.contentHtml);
    recordText(row.contentMd);
  }

  const settingRows = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.siteId, siteId))
    .all();
  for (const row of settingRows) {
    recordText(row.value);
  }

  return referenced;
}

/** Result summary returned after cleaning up unreferenced tenant media objects. */
export interface OrphanCleanupResult {
  deletedCount: number;
  freedBytes: number;
  deletedPaths: string[];
}

/**
 * Deletes tenant-scoped media files that are no longer referenced by any post, page, site asset, user avatar, or setting
 * and whose age exceeds `gracePeriodMs` (protecting in-flight uploads during editing).
 *
 * @param siteId - Tenant site identifier.
 * @param options - Optional grace period configuration (defaults to 60,000 ms).
 * @returns Deletion counts, reclaimed bytes, and deleted logical paths.
 */
export async function cleanupOrphanMedia(
  siteId: string,
  options: { gracePeriodMs?: number } = {}
): Promise<OrphanCleanupResult> {
  if (!siteId) {
    return { deletedCount: 0, freedBytes: 0, deletedPaths: [] };
  }

  const gracePeriodMs = options.gracePeriodMs ?? 60_000;
  const cutoffMs = Date.now() - Math.max(0, gracePeriodMs);
  const referenced = collectReferencedMediaPaths(siteId);
  const { objects } = await listAllTenantObjects(siteId);

  const deletedPaths: string[] = [];
  let freedBytes = 0;

  for (const obj of objects) {
    if (obj.mtimeMs > cutoffMs) continue;
    if (referenced.has(obj.physicalPath) || referenced.has(obj.logicalPath)) {
      continue;
    }
    const deleted = await deleteFromStorage(obj.logicalPath, false, siteId);
    if (deleted) {
      deletedPaths.push(obj.logicalPath);
      freedBytes += obj.size;
    }
  }

  return {
    deletedCount: deletedPaths.length,
    freedBytes,
    deletedPaths,
  };
}
