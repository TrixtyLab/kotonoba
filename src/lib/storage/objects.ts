import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { Readable } from "stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { ensureDir } from "@/lib/utils/fs";
import { getS3Client, getSafeMediaContentType, getStorageConfig } from "./config";
import { isObjectStorageConfigured, resolveContainedLocalPath, sanitizePath, scopeStoragePath, unscopeStoragePath } from "./paths";
import type { StorageConfig, StoredMediaReadResult, UploadResult } from "./types";

async function toWebStreamOrBuffer(body: unknown): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ReadableStream) return body as ReadableStream<Uint8Array>;
  const streamObj = body as { transformToWebStream?: () => ReadableStream<Uint8Array>; pipe?: unknown; transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof streamObj.transformToWebStream === "function") return streamObj.transformToWebStream();
  if (typeof streamObj.pipe === "function") return Readable.toWeb(body as Readable) as unknown as ReadableStream<Uint8Array>;
  if (typeof streamObj.transformToByteArray === "function") return Buffer.from(await streamObj.transformToByteArray());
  return null;
}

async function readRemoteMediaObject(
  config: StorageConfig,
  cleanRelative: string,
  contentType: string,
  ifNoneMatch?: string | null
): Promise<StoredMediaReadResult> {
  try {
    const res = await getS3Client(config).send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: cleanRelative,
        ...(ifNoneMatch ? { IfNoneMatch: ifNoneMatch } : {}),
      })
    );
    const body = await toWebStreamOrBuffer(res.Body);
    if (!body) return { status: "not-found" };
    return {
      status: "ok",
      body,
      contentType,
      contentLength: typeof res.ContentLength === "number" ? res.ContentLength : undefined,
      etag: res.ETag,
    };
  } catch (error) {
    const metaStatus = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const errName = (error as { name?: string })?.name;
    if (metaStatus === 304 || errName === "NotModified") return { status: "not-modified", etag: ifNoneMatch || undefined };
    if (metaStatus === 404 || errName === "NoSuchKey" || errName === "NotFound") return { status: "not-found" };
    throw error;
  }
}

/** Reads or streams a stored media asset directly from R2/S3 or local disk without external redirects. */
export async function readStoredMediaObject(
  relativePath: string,
  options: { siteId?: string; ifNoneMatch?: string | null } = {}
): Promise<StoredMediaReadResult> {
  const cleanRelative = sanitizePath(relativePath);
  if (!cleanRelative || cleanRelative.split("/").some((seg) => seg.startsWith("."))) {
    return { status: "not-found" };
  }

  const config = getStorageConfig(options.siteId);
  const contentType = getSafeMediaContentType(cleanRelative);
  if (isObjectStorageConfigured(config)) {
    return readRemoteMediaObject(config, cleanRelative, contentType, options.ifNoneMatch);
  }

  let filePath: string;
  try {
    filePath = resolveContainedLocalPath(config.uploadDir, cleanRelative);
  } catch {
    return { status: "not-found" };
  }

  const uploadRoot = path.resolve(/*turbopackIgnore: true*/ config.uploadDir);
  if (filePath === uploadRoot || !filePath.startsWith(uploadRoot + path.sep) || !existsSync(/*turbopackIgnore: true*/ filePath)) {
    return { status: "not-found" };
  }

  const [realRoot, realFile] = await Promise.all([fs.realpath(/*turbopackIgnore: true*/ uploadRoot), fs.realpath(/*turbopackIgnore: true*/ filePath)]);
  if (!realFile.startsWith(realRoot + path.sep)) return { status: "not-found" };

  const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ realFile);
  return { status: "ok", body: fileBuffer, contentType: getSafeMediaContentType(realFile), contentLength: fileBuffer.byteLength };
}

/** Uploads a file buffer to the active storage provider (`r2`, `s3`, or local disk). */
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
  const baseName = path.basename(originalFilename, ext).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "asset";
  const rawFilename = `${baseName}-${Date.now()}${ext}`;
  const scopedBase = scopeStoragePath(cleanFolder, siteId);
  const physicalPath = scopedBase ? `${scopedBase}/${rawFilename}` : rawFilename;
  const logicalPath = unscopeStoragePath(physicalPath, siteId);

  if (isObjectStorageConfigured(config)) {
    await getS3Client(config).send(new PutObjectCommand({ Bucket: config.bucket, Key: physicalPath, Body: buffer, ContentType: contentType }));
    const fileUrl =
      config.publicUrl && !config.publicUrl.includes("r2.cloudflarestorage.com")
        ? `${config.publicUrl}/${physicalPath}`
        : `/api/uploads/${physicalPath}`;
    return { url: fileUrl, filename: rawFilename, path: logicalPath, size: buffer.length, mimeType: contentType };
  }

  const destinationPath = resolveContainedLocalPath(config.uploadDir, physicalPath);
  ensureDir(path.dirname(destinationPath));
  await fs.writeFile(/*turbopackIgnore: true*/ destinationPath, buffer);
  return { url: `/api/uploads/${physicalPath}`, filename: rawFilename, path: logicalPath, size: buffer.length, mimeType: contentType };
}

/** Creates a directory folder inside the tenant storage workspace. */
export async function createFolder(folderName: string, parentFolder = "", siteId?: string): Promise<boolean> {
  const cleanParent = sanitizePath(parentFolder);
  const cleanName = folderName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!cleanName || cleanName === "sites") return false;

  const folderPath = scopeStoragePath(cleanParent ? `${cleanParent}/${cleanName}` : cleanName, siteId);
  const config = getStorageConfig(siteId);
  if (isObjectStorageConfigured(config)) {
    try {
      await getS3Client(config).send(new PutObjectCommand({ Bucket: config.bucket, Key: `${folderPath}/.keep`, Body: Buffer.from(""), ContentType: "application/x-directory" }));
      return true;
    } catch {
      return false;
    }
  }

  try {
    ensureDir(resolveContainedLocalPath(config.uploadDir, folderPath));
    return true;
  } catch {
    return false;
  }
}

/** Moves a stored media item into a target directory within the tenant workspace. */
export async function moveMediaItem(itemPath: string, targetFolder: string, siteId?: string): Promise<boolean> {
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
  if (isObjectStorageConfigured(config)) {
    try {
      const s3 = getS3Client(config);
      await s3.send(new CopyObjectCommand({ Bucket: config.bucket, CopySource: `${config.bucket}/${cleanItem}`, Key: newPath }));
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: cleanItem }));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const sourceFullPath = resolveContainedLocalPath(config.uploadDir, cleanItem);
    const targetDir = resolveContainedLocalPath(config.uploadDir, scopedTarget);
    ensureDir(targetDir);
    if (!existsSync(sourceFullPath)) return false;
    await fs.rename(sourceFullPath, path.join(targetDir, filename));
    return true;
  } catch {
    return false;
  }
}

/** Deletes a file or directory recursively from the active storage backend. */
export async function deleteFromStorage(itemPath: string, isFolder = false, siteId?: string): Promise<boolean> {
  let scopedItem: string;
  try {
    scopedItem = scopeStoragePath(itemPath, siteId);
  } catch {
    return false;
  }
  if (!scopedItem || (siteId && scopedItem === `sites/${siteId}`)) return false;

  const config = getStorageConfig(siteId);
  if (isObjectStorageConfigured(config)) {
    try {
      const s3 = getS3Client(config);
      if (isFolder) {
        const listRes = await s3.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: `${scopedItem}/` }));
        for (const obj of listRes.Contents || []) {
          if (obj.Key) await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: obj.Key }));
        }
      } else {
        await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: scopedItem }));
      }
      return true;
    } catch {
      return false;
    }
  }

  try {
    const fullPath = resolveContainedLocalPath(config.uploadDir, scopedItem);
    if (!existsSync(fullPath)) return false;
    if (isFolder) await fs.rm(fullPath, { recursive: true, force: true });
    else await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}
