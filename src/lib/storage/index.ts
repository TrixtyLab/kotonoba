import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getDb } from "@/lib/db";
import { settings, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
 * Resolves the absolute local filesystem directory used for persistent uploads.
 *
 * @returns Absolute directory path string.
 */
export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
}

/**
 * Ensures a directory path exists on the local filesystem.
 *
 * @param dir - Absolute directory path string.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(/*turbopackIgnore: true*/ dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Dynamically resolves the active storage configuration for a given tenant site.
 * Inspects SQLite settings for custom S3/R2 credentials, falling back to environment variables and local disk.
 *
 * @param siteId - Optional site identifier to retrieve site-specific storage settings.
 * @returns Resolved StorageConfig object.
 */
export function getStorageConfig(siteId?: string): StorageConfig {
  const uploadDir = getUploadDir();
  ensureDir(uploadDir);

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
    S3_BUCKET,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
  } = process.env;

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
        const secretAccessKey =
          map.s3_secret_key || R2_SECRET_ACCESS_KEY || AWS_SECRET_ACCESS_KEY || "";
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

export { normalizeMediaUrl, resolveAbsoluteUrl, normalizeHtmlMediaUrls } from "@/lib/utils/media";

/**
 * Generates a presigned GET access grant URL for an object residing in a private S3/R2 bucket.
 *
 * @param filePath - Relative path to the stored media object.
 * @param expiresInSeconds - Access grant duration in seconds. Defaults to 3600 (1 hour).
 * @param siteId - Optional site identifier.
 * @returns Promise resolving to the signed access URL string.
 */
export async function getPresignedMediaUrl(
  filePath: string,
  expiresInSeconds = 3600,
  siteId?: string
): Promise<string> {
  const config = getStorageConfig(siteId);
  const cleanPath = sanitizePath(filePath);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: cleanPath,
      });
      return await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    } catch {
      return `/api/uploads/${cleanPath}`;
    }
  }

  return `/api/uploads/${cleanPath}`;
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

/**
 * Sanitizes a path string by removing backslashes, leading/trailing slashes, and traversal sequences.
 *
 * @param p - Raw path string.
 * @returns Sanitized relative path string.
 */
export function sanitizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
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

  const ext = path.extname(originalFilename).toLowerCase();
  const baseName = path
    .basename(originalFilename, ext)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const timestamp = Date.now();
  const rawFilename = `${baseName}-${timestamp}${ext}`;
  const relativePath = cleanFolder ? `${cleanFolder}/${rawFilename}` : rawFilename;

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    const s3 = getS3Client(config);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: relativePath,
      Body: buffer,
      ContentType: contentType,
    });

    await s3.send(command);

    let fileUrl: string;
    if (config.publicUrl && !config.publicUrl.includes("r2.cloudflarestorage.com")) {
      fileUrl = `${config.publicUrl}/${relativePath}`;
    } else {
      fileUrl = `/api/uploads/${relativePath}`;
    }

    return {
      url: fileUrl,
      filename: rawFilename,
      path: relativePath,
      size: buffer.length,
      mimeType: contentType,
    };
  }

  const baseUploadDir = config.uploadDir;
  const targetDir = cleanFolder ? path.join(/*turbopackIgnore: true*/ baseUploadDir, cleanFolder) : baseUploadDir;
  ensureDir(targetDir);

  const destinationPath = path.join(/*turbopackIgnore: true*/ targetDir, rawFilename);
  await fs.writeFile(/*turbopackIgnore: true*/ destinationPath, buffer);

  return {
    url: `/api/uploads/${relativePath}`,
    filename: rawFilename,
    path: relativePath,
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

  if (!cleanName) return false;
  const folderPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName;

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
    const fullPath = path.join(config.uploadDir, folderPath);
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
  const cleanItem = sanitizePath(itemPath);
  const cleanTarget = sanitizePath(targetFolder);
  const filename = path.basename(cleanItem);
  const newPath = cleanTarget ? `${cleanTarget}/${filename}` : filename;

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
    const baseUploadDir = config.uploadDir;
    const sourceFullPath = path.join(baseUploadDir, cleanItem);
    const targetDir = cleanTarget ? path.join(baseUploadDir, cleanTarget) : baseUploadDir;
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
  const cleanItem = sanitizePath(itemPath);
  if (!cleanItem) return false;

  const config = getStorageConfig(siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);

      if (isFolder) {
        const prefix = `${cleanItem}/`;
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
            Key: cleanItem,
          })
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  try {
    const fullPath = path.join(config.uploadDir, cleanItem);
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
  const cleanFolder = sanitizePath(folder);
  const config = getStorageConfig(siteId);

  let parentFolder: string | null = null;
  if (cleanFolder) {
    const segments = cleanFolder.split("/");
    segments.pop();
    parentFolder = segments.join("/");
  }

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      const prefix = cleanFolder ? `${cleanFolder}/` : "";

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
          path: folderFullPath,
        };
      });

      const publicUrlBase = config.publicUrl;

      const files: MediaFileItem[] = await Promise.all(
        (res.Contents || [])
          .filter((obj) => obj.Key && !obj.Key.endsWith("/") && !obj.Key.endsWith(".keep"))
          .map(async (obj) => {
            const filePath = obj.Key!;
            const filename = path.basename(filePath);
            
            let url: string;
            if (publicUrlBase && !publicUrlBase.includes("r2.cloudflarestorage.com")) {
              url = `${publicUrlBase}/${filePath}`;
            } else {
              url = `/api/uploads/${filePath}`;
            }

            return {
              filename,
              path: filePath,
              url,
              size: obj.Size || 0,
              updatedAt: obj.LastModified || new Date(),
              folder: cleanFolder,
            };
          })
      );

      return {
        currentFolder: cleanFolder,
        parentFolder,
        folders,
        files: files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      };
    } catch {
      return { currentFolder: cleanFolder, parentFolder, folders: [], files: [] };
    }
  }

  const baseUploadDir = config.uploadDir;
  const currentDir = cleanFolder ? path.join(baseUploadDir, cleanFolder) : baseUploadDir;

  if (!existsSync(currentDir)) {
    return { currentFolder: cleanFolder, parentFolder, folders: [], files: [] };
  }

  try {
    const dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    const folders: MediaFolderItem[] = [];
    const files: MediaFileItem[] = [];

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        const subPath = cleanFolder ? `${cleanFolder}/${entry.name}` : entry.name;
        folders.push({
          name: entry.name,
          path: subPath,
        });
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        const fileFullPath = path.join(currentDir, entry.name);
        const stat = await fs.stat(fileFullPath);
        const relativeFilePath = cleanFolder ? `${cleanFolder}/${entry.name}` : entry.name;

        files.push({
          filename: entry.name,
          path: relativeFilePath,
          url: `/api/uploads/${relativeFilePath}`,
          size: stat.size,
          updatedAt: stat.mtime,
          folder: cleanFolder,
        });
      }
    }

    return {
      currentFolder: cleanFolder,
      parentFolder,
      folders,
      files: files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    };
  } catch {
    return { currentFolder: cleanFolder, parentFolder, folders: [], files: [] };
  }
}
