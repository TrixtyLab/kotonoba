import path from "path";
import { S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { ensureDir } from "@/lib/utils/fs";
import { getDb } from "@/lib/db";
import { settings, sites } from "@/lib/db/schema";
import { decryptSecretOrLegacyPlaintext } from "@/lib/security/crypto";
import { getRuntimeUploadDir, getStorageEnvCredentials, type StorageEnvCredentials } from "@/lib/config/env";
import type { StorageConfig, StoredMediaReadResult } from "./types";

const MEDIA_MIME_MAP: Record<string, string> = {
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function resolveRemoteProviderFromEnvOrSettings(
  configuredProvider: string | undefined,
  creds: StorageEnvCredentials
): "local" | "s3" | "r2" {
  if (configuredProvider === "local" || configuredProvider === "s3" || configuredProvider === "r2") {
    return configuredProvider;
  }
  if (creds.r2AccountId && creds.r2AccessKeyId && creds.r2SecretAccessKey && creds.r2BucketName) return "r2";
  if (creds.s3Bucket && creds.awsAccessKeyId && creds.awsSecretAccessKey) return "s3";
  return "local";
}

function buildEnvFallbackStorageConfig(creds: StorageEnvCredentials, uploadDir: string): StorageConfig {
  if (creds.r2AccountId && creds.r2AccessKeyId && creds.r2SecretAccessKey && creds.r2BucketName) {
    return {
      provider: "r2",
      bucket: creds.r2BucketName,
      region: "auto",
      endpoint: `https://${creds.r2AccountId}.r2.cloudflarestorage.com`,
      accessKeyId: creds.r2AccessKeyId,
      secretAccessKey: creds.r2SecretAccessKey,
      publicUrl: (creds.r2PublicUrl || "").replace(/\/$/, "") || undefined,
      uploadDir,
    };
  }

  if (creds.s3Bucket && creds.awsAccessKeyId && creds.awsSecretAccessKey) {
    return {
      provider: "s3",
      bucket: creds.s3Bucket,
      region: creds.awsRegion || "us-east-1",
      accessKeyId: creds.awsAccessKeyId,
      secretAccessKey: creds.awsSecretAccessKey,
      uploadDir,
    };
  }

  return { provider: "local", publicUrl: "/api/uploads", uploadDir };
}

function pickFirstString(...values: Array<string | undefined>): string {
  for (const val of values) {
    if (val) return val;
  }
  return "";
}

function resolveRemoteConfigFromSettings(
  map: Record<string, string>,
  creds: StorageEnvCredentials,
  uploadDir: string
): StorageConfig | null {
  const provider = resolveRemoteProviderFromEnvOrSettings(map.storage_provider, creds);
  if (provider === "local") return null;

  const bucket = pickFirstString(map.s3_bucket, creds.r2BucketName, creds.s3Bucket);
  const accessKeyId = pickFirstString(map.s3_access_key, creds.r2AccessKeyId, creds.awsAccessKeyId);
  const rawSecretKey = map.s3_secret_key ? decryptSecretOrLegacyPlaintext(map.s3_secret_key) : "";
  const secretAccessKey = pickFirstString(rawSecretKey, creds.r2SecretAccessKey, creds.awsSecretAccessKey);
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const r2Endpoint =
    provider === "r2" && creds.r2AccountId ? `https://${creds.r2AccountId}.r2.cloudflarestorage.com` : undefined;
  const publicUrl = pickFirstString(map.s3_public_url, creds.r2PublicUrl).replace(/\/$/, "") || undefined;

  return {
    provider,
    bucket,
    region: pickFirstString(map.s3_region, creds.awsRegion, "auto"),
    endpoint: pickFirstString(map.s3_endpoint, r2Endpoint) || undefined,
    accessKeyId,
    secretAccessKey,
    publicUrl,
    uploadDir,
  };
}

/**
 * Dynamically resolves the active storage configuration for a given tenant site.
 */
export function getStorageConfig(siteId?: string): StorageConfig {
  const uploadDir = getRuntimeUploadDir();
  ensureDir(uploadDir);
  const creds = getStorageEnvCredentials();

  try {
    const db = getDb();
    const targetSiteId = siteId || db.select({ id: sites.id }).from(sites).limit(1).get()?.id;
    if (targetSiteId) {
      const siteSettings = db.select().from(settings).where(eq(settings.siteId, targetSiteId)).all();
      const map: Record<string, string> = {};
      for (const s of siteSettings) map[s.key] = s.value;
      const fromDb = resolveRemoteConfigFromSettings(map, creds, uploadDir);
      if (fromDb) return fromDb;
    }
  } catch {
    // Non-blocking fallback to environment variables / local disk
  }

  return buildEnvFallbackStorageConfig(creds, uploadDir);
}

/** Instantiates an AWS SDK `S3Client` configured with the provided storage settings. */
export function getS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint || undefined,
    credentials: { accessKeyId: config.accessKeyId!, secretAccessKey: config.secretAccessKey! },
  });
}

/** Returns a summary of current storage driver status for administrative UI inspection. */
export function getStorageStatus(siteId?: string) {
  const config = getStorageConfig(siteId);
  return {
    provider: config.provider,
    bucketName: config.bucket,
    uploadDir: config.provider === "local" ? config.uploadDir : undefined,
    publicUrl: config.publicUrl,
  };
}

/** Resolves an allowlisted `Content-Type` from filename extension. */
export function getSafeMediaContentType(filePath: string): string {
  return MEDIA_MIME_MAP[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

/** Builds HTTP caching, `nosniff`, and SVG sandbox headers for a resolved media asset. */
export function buildMediaAssetHeaders(
  asset: Extract<StoredMediaReadResult, { status: "ok" }>,
  cacheControl = "public, max-age=31536000, immutable"
): Record<string, string> {
  const isSvg = asset.contentType === "image/svg+xml";
  return {
    "Content-Type": asset.contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    ...(asset.contentLength !== undefined ? { "Content-Length": String(asset.contentLength) } : {}),
    ...(asset.etag ? { ETag: asset.etag } : {}),
    ...(isSvg
      ? {
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "Content-Disposition": "inline",
        }
      : {}),
  };
}
