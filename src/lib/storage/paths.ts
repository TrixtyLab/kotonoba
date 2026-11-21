import path from "path";
import type { StorageConfig } from "./types";

/**
 * Sanitizes a path string by removing backslashes, leading/trailing slashes, and traversal segments.
 */
export function sanitizePath(p: string): string {
  const normalized = p.replace(/\\/g, "/").replaceAll("\0", "");
  return normalized
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..")
    .join("/");
}

/**
 * Resolves a logical media path into a tenant-scoped storage key (`sites/<siteId>/...`).
 */
export function scopeStoragePath(logicalPath: string, siteId?: string): string {
  const clean = sanitizePath(logicalPath);
  if (!siteId) return clean;

  const tenantPrefix = `sites/${siteId}`;
  if (!clean || clean === "sites") return tenantPrefix;
  if (clean === tenantPrefix || clean.startsWith(`${tenantPrefix}/`)) return clean;
  if (clean.startsWith("sites/")) throw new Error("FORBIDDEN_MEDIA_PATH");
  return `${tenantPrefix}/${clean}`;
}

/**
 * Strips the tenant prefix (`sites/<siteId>/`) from a physical path to produce a logical folder path.
 */
export function unscopeStoragePath(physicalPath: string, siteId?: string): string {
  const clean = sanitizePath(physicalPath);
  if (!siteId) return clean;
  const tenantPrefix = `sites/${siteId}`;
  if (clean === tenantPrefix) return "";
  if (clean.startsWith(`${tenantPrefix}/`)) return clean.slice(tenantPrefix.length + 1);
  return clean;
}

/**
 * Resolves a relative path safely within `uploadDir`, rejecting directory escapes.
 */
export function resolveContainedLocalPath(uploadDir: string, relativePath: string): string {
  const root = path.resolve(/*turbopackIgnore: true*/ uploadDir);
  const resolved = relativePath ? path.resolve(/*turbopackIgnore: true*/ root, relativePath) : root;
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("INVALID_MEDIA_PATH");
  }
  return resolved;
}

/**
 * Returns `true` when resolved storage config targets an object storage bucket (R2 or S3).
 */
export function isObjectStorageConfigured(config: StorageConfig): boolean {
  return Boolean(
    (config.provider === "r2" || config.provider === "s3") &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey
  );
}
