import path from "path";
import { z } from "zod";

const positiveIntSchema = z.coerce.number().int().positive();
const nonNegativeIntSchema = z.coerce.number().int().min(0);

/**
 * Validated runtime environment configuration snapshot.
 */
export interface RuntimeEnvConfig {
  nodeEnv: "development" | "production" | "test";
  dbPath: string;
  uploadDir: string;
  siteUrl: string;
  adminDomain: string | null;
  cspMode: "report-only" | "enforce";
  maxUploadSize: number;
  maxSiteStorageBytes: number;
  maxBackupSize: number;
  maxBackupFiles: number;
  maxBackupUncompressedBytes: number;
  maxBackupJsonBytes: number;
  allowLegacyBackupImport: boolean;
  trustedProxyIps: string[];
  cronSecret: string | null;
  analyticsRetentionDays: number;
}

/** Redacted environment-backed R2/S3 status exposed safely to admin storage settings UI. */
export interface StorageEnvSummary {
  isR2Configured: boolean;
  isS3Configured: boolean;
  r2Bucket?: string;
  r2AccountId?: string;
  r2PublicUrl?: string;
  s3Bucket?: string;
  s3Region?: string;
}

/** Full server-side R2/S3 fallback credentials read from environment variables. */
export interface StorageEnvCredentials {
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2PublicUrl?: string;
  s3Bucket?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (!value || !value.trim()) return fallback;
  const parsed = positiveIntSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : fallback;
}

function parseNonNegativeIntEnv(value: string | undefined, fallback: number): number {
  if (!value || !value.trim()) return fallback;
  const parsed = nonNegativeIntSchema.safeParse(value.trim());
  return parsed.success ? parsed.data : fallback;
}

/** Returns `true` when running with `NODE_ENV === "production"`. */
export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Returns `true` when running with `NODE_ENV === "development"`. */
export function isDevelopmentEnv(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Resolves the SQLite database path dynamically so test harnesses can swap `DB_PATH`. */
export function getRuntimeDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (isProductionEnv()) {
    return "/app/data/kotonoba.db";
  }
  return path.join(process.cwd(), "data", "blog.db");
}

/** Resolves the persistent local upload directory dynamically from `UPLOAD_DIR`. */
export function getRuntimeUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  if (isProductionEnv()) {
    return "/app/data/uploads";
  }
  return path.join(process.cwd(), "data", "uploads");
}

/** Returns the default site base URL (`SITE_URL` / `NEXT_PUBLIC_APP_URL`). */
export function getDefaultSiteUrl(): string {
  return process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

/** Returns optional `ADMIN_DOMAIN` environment variable trimmed/lowercased. */
export function getAdminDomainEnv(): string | null {
  return process.env.ADMIN_DOMAIN?.trim().toLowerCase() || null;
}

/** Returns whether unmatched non-local hosts allow single-tenant fallback. */
export function isSingleTenantFallbackEnabled(): boolean {
  return process.env.SINGLE_TENANT_FALLBACK === "true";
}

/** Returns configured Content-Security-Policy enforcement mode (`report-only` or `enforce`). */
export function getCspModeEnv(): "report-only" | "enforce" {
  return process.env.CSP_MODE?.trim().toLowerCase() === "enforce" ? "enforce" : "report-only";
}

/** Returns explicit `APP_VERSION` environment override when injected at runtime/build time. */
export function getAppVersionEnv(): string | null {
  const raw = process.env.APP_VERSION?.trim();
  return raw ? raw : null;
}

/** Returns configured session access token TTL expression. */
export function getSessionDurationEnv(): string {
  return process.env.SESSION_DURATION || process.env.JWT_EXPIRES_IN || "30d";
}

/** Returns configured refresh token TTL expression. */
export function getRefreshDurationEnv(): string {
  return process.env.REFRESH_DURATION || process.env.REFRESH_EXPIRES_IN || "90d";
}

/** Returns optional previous `ENCRYPTION_KEY_PREVIOUS` for seamless key rotation reads. */
export function getPreviousEncryptionKeyEnv(): string | undefined {
  return process.env.ENCRYPTION_KEY_PREVIOUS?.trim() || undefined;
}

/** Returns backup encryption configuration values from environment variables. */
export function getBackupEncryptionEnv(): { rawKey?: string; keyId: string; allowLegacy: boolean } {
  return {
    rawKey: process.env.BACKUP_ENCRYPTION_KEY?.trim() || undefined,
    keyId: (process.env.BACKUP_KEY_ID || "v1").trim(),
    allowLegacy: process.env.ALLOW_LEGACY_BACKUP_IMPORT === "true",
  };
}

/** Returns Dub.co API configuration from environment variables. */
export function getDubEnvConfig(): { apiKey?: string; domain: string } {
  const apiKey = process.env.DUB_API_KEY?.trim();
  return {
    apiKey: apiKey || undefined,
    domain: process.env.DUB_DOMAIN?.trim() || "dub.sh",
  };
}

/** Returns redacted R2/S3 environment status safe to send to admin settings components. */
export function getStorageEnvSummary(): StorageEnvSummary {
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

  return {
    isR2Configured: Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME),
    isS3Configured: Boolean(
      (S3_BUCKET || R2_BUCKET_NAME) &&
        (AWS_ACCESS_KEY_ID || R2_ACCESS_KEY_ID) &&
        (AWS_SECRET_ACCESS_KEY || R2_SECRET_ACCESS_KEY)
    ),
    r2Bucket: R2_BUCKET_NAME,
    r2AccountId: R2_ACCOUNT_ID ? `${R2_ACCOUNT_ID.slice(0, 6)}••••••` : undefined,
    r2PublicUrl: R2_PUBLIC_URL,
    s3Bucket: S3_BUCKET,
    s3Region: AWS_REGION,
  };
}

/** Returns raw R2/S3 fallback environment credentials for server-only storage clients. */
export function getStorageEnvCredentials(): StorageEnvCredentials {
  return {
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2PublicUrl: process.env.R2_PUBLIC_URL,
    s3Bucket: process.env.S3_BUCKET,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION,
  };
}

/** Returns analytics retention window in days (`0` disables pruning; defaults to `365`). */
export function getAnalyticsRetentionDays(): number {
  return parseNonNegativeIntEnv(process.env.ANALYTICS_RETENTION_DAYS, 365);
}

/**
 * Parses and normalizes runtime operational environment variables with safe bounds.
 *
 * @returns Validated `RuntimeEnvConfig` object.
 */
export function getEnvConfig(): RuntimeEnvConfig {
  const rawNodeEnv = process.env.NODE_ENV;
  const nodeEnv: "development" | "production" | "test" =
    rawNodeEnv === "production" || rawNodeEnv === "test" ? rawNodeEnv : "development";

  const trustedProxyIps = (process.env.TRUSTED_PROXY_IPS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    dbPath: getRuntimeDbPath(),
    uploadDir: getRuntimeUploadDir(),
    siteUrl: getDefaultSiteUrl(),
    adminDomain: getAdminDomainEnv(),
    cspMode: getCspModeEnv(),
    maxUploadSize: parsePositiveIntEnv(process.env.MAX_UPLOAD_SIZE, 10 * 1024 * 1024),
    maxSiteStorageBytes: parseNonNegativeIntEnv(process.env.MAX_SITE_STORAGE_BYTES, 500 * 1024 * 1024),
    maxBackupSize: parsePositiveIntEnv(process.env.MAX_BACKUP_SIZE, 100 * 1024 * 1024),
    maxBackupFiles: parsePositiveIntEnv(process.env.MAX_BACKUP_FILES, 5000),
    maxBackupUncompressedBytes: parsePositiveIntEnv(process.env.MAX_BACKUP_UNCOMPRESSED_BYTES, 500 * 1024 * 1024),
    maxBackupJsonBytes: parsePositiveIntEnv(process.env.MAX_BACKUP_JSON_BYTES, 25 * 1024 * 1024),
    allowLegacyBackupImport: process.env.ALLOW_LEGACY_BACKUP_IMPORT === "true",
    trustedProxyIps,
    cronSecret: process.env.CRON_SECRET?.trim() || null,
    analyticsRetentionDays: getAnalyticsRetentionDays(),
  };
}
