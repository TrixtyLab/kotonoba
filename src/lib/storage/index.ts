import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { ensureDir } from "@/lib/utils/fs";
import { generateId } from "@/lib/utils/slug";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getDb } from "@/lib/db";
import { settings, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Result payload returned after successfully uploading an asset to storage.
 */
export interface UploadResult {
  /** Publicly accessible URL to access the uploaded asset. */
  url: string;
  /** Generated unique filename on the storage backend. */
  filename: string;
  /** Normalized relative path including parent folders. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** MIME content type of the uploaded asset. */
  mimeType: string;
  /** Target storage driver provider. */
  provider: "r2" | "s3" | "local";
}

/**
 * Metadata representation of a file stored in media storage.
 */
export interface MediaFileItem {
  /** Basename of the file. */
  filename: string;
  /** Normalized path relative to the root storage bucket or upload folder. */
  path: string;
  /** Direct public URL for media display. */
  url: string;
  /** File size in bytes. */
  size: number;
  /** Last modification timestamp. */
  updatedAt: Date;
  /** Parent folder path or empty string for root. */
  folder: string;
}

/**
 * Representation of a virtual or filesystem folder in media storage.
 */
export interface MediaFolderItem {
  /** Display name of the folder directory. */
  name: string;
  /** Relative directory path. */
  path: string;
  /** Optional count of contained items. */
  itemCount?: number;
}

/**
 * Paginated or scoped listing result of media files and subfolders within a directory.
 */
export interface MediaListingResult {
  /** Relative path of the currently browsed directory. */
  currentFolder: string;
  /** Relative path of the parent directory, or null if at root. */
  parentFolder: string | null;
  /** Subdirectories located within the current folder. */
  folders: MediaFolderItem[];
  /** File assets located within the current folder. */
  files: MediaFileItem[];
}

/**
 * Storage driver runtime configuration parameters.
 */
export interface StorageConfig {
  /** Active storage provider driver. */
  provider: "local" | "s3" | "r2";
  /** S3 or R2 bucket identifier. */
  bucket?: string;
  /** AWS or S3-compatible region string. */
  region?: string;
  /** Custom endpoint URL for S3 or Cloudflare R2. */
  endpoint?: string;
  /** Access Key ID for authentication. */
  accessKeyId?: string;
  /** Secret Access Key for authentication. */
  secretAccessKey?: string;
  /** Public CDN or base URL for serving files. */
  publicUrl: string;
  /** Local filesystem directory path for storage fallback. */
  uploadDir: string;
}

/**
 * Resolves the absolute directory path used for local file uploads.
 *
 * @returns Absolute filesystem path string.
 */
export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
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

      const provider = (map.storage_provider as "local" | "s3" | "r2") || "local";

      if (provider === "r2" || provider === "s3") {
        const bucket = map.s3_bucket || process.env.R2_BUCKET_NAME || process.env.S3_BUCKET || "";
        const region = map.s3_region || process.env.AWS_REGION || "auto";
        const endpoint = map.s3_endpoint || (provider === "r2" && process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
        const accessKeyId = map.s3_access_key || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
        const secretAccessKey = map.s3_secret_key || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
        const publicUrl = (map.s3_public_url || process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

        if (bucket && accessKeyId && secretAccessKey) {
          return {
            provider,
            bucket,
            region,
            endpoint,
            accessKeyId,
            secretAccessKey,
            publicUrl: publicUrl || `/api/uploads`,
            uploadDir,
          };
        }
      }
    }
  } catch {
    // Database query failed (e.g. during initial migration), fallback to environment variables
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
    return {
      provider: "r2",
      bucket: R2_BUCKET_NAME,
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      publicUrl: (R2_PUBLIC_URL || "").replace(/\/$/, ""),
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
function getS3Client(config: StorageConfig): S3Client {
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

/**
 * Sanitizes a path string by removing backslashes, leading/trailing slashes, and traversal sequences.
 *
 * @param p - Raw path string.
 * @returns Sanitized relative path string.
 */
function sanitizePath(p: string): string {
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
  const ext = path.extname(originalFilename) || ".jpg";
  const rawFilename = `${generateId()}${ext}`;
  const cleanFolder = sanitizePath(targetFolder);
  const relativePath = cleanFolder ? `${cleanFolder}/${rawFilename}` : rawFilename;

  const config = getStorageConfig(siteId);

  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    const s3 = getS3Client(config);
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: relativePath,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = config.publicUrl ? `${config.publicUrl}/${relativePath}` : `/api/uploads/${relativePath}`;

    return {
      url: publicUrl,
      filename: rawFilename,
      path: relativePath,
      size: buffer.length,
      mimeType: contentType,
      provider: config.provider,
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
    provider: "local",
  };
}

/**
 * Creates a new virtual or filesystem folder in the configured storage provider.
 *
 * @param folderName - Name of the directory to create.
 * @param parentFolder - Parent folder path. Defaults to root.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to true if created successfully, false otherwise.
 */
export async function createFolder(folderName: string, parentFolder = "", siteId?: string): Promise<boolean> {
  const safeName = folderName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "-");
  if (!safeName) return false;

  const cleanParent = sanitizePath(parentFolder);
  const folderPath = cleanParent ? `${cleanParent}/${safeName}` : safeName;

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
    if (existsSync(fullPath)) {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists all folders and files located within a specific directory path of storage.
 *
 * @param folderPath - Target directory path to inspect. Defaults to root.
 * @param siteId - Optional site identifier.
 * @returns A Promise resolving to a MediaListingResult containing folders and file records.
 */
export async function listMediaFiles(
  folderPath = "",
  siteId?: string
): Promise<MediaListingResult> {
  const cleanFolder = sanitizePath(folderPath);
  const parentFolder = cleanFolder.includes("/")
    ? cleanFolder.split("/").slice(0, -1).join("/")
    : cleanFolder
    ? ""
    : null;

  const config = getStorageConfig(siteId);

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

      const files: MediaFileItem[] = (res.Contents || [])
        .filter((obj) => obj.Key && !obj.Key.endsWith("/") && !obj.Key.endsWith(".keep"))
        .map((obj) => {
          const filePath = obj.Key!;
          const filename = path.basename(filePath);
          const url = publicUrlBase ? `${publicUrlBase}/${filePath}` : `/api/uploads/${filePath}`;
          return {
            filename,
            path: filePath,
            url,
            size: obj.Size || 0,
            updatedAt: obj.LastModified || new Date(),
            folder: cleanFolder,
          };
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return {
        currentFolder: cleanFolder,
        parentFolder,
        folders,
        files,
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
