import crypto from "crypto";
import path from "path";
import JSZip from "jszip";
import type { RuntimeEnvConfig } from "@/lib/config/env";
import { isLegacyBackupImportEnabled } from "@/lib/config/features";
import { decryptBackupArchive, isEncryptedBackup } from "./crypto";
import type { BackupManifest } from "./export";
import type { BackupData } from "./types";

/** Validates relative archive entry paths, blocking Zip-Slip and absolute escapes. */
export function isSafeArchiveEntryPath(entryPath: string): boolean {
  if (!entryPath || entryPath.includes("\\") || entryPath.includes("\0")) return false;
  if (entryPath.startsWith("/") || path.isAbsolute(entryPath)) return false;
  return entryPath.split("/").every((seg) => seg !== ".." && seg !== ".");
}

function getZipEntryUncompressedSize(entry: JSZip.JSZipObject): number | null {
  const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === "number" && Number.isFinite(data.uncompressedSize)
    ? data.uncompressedSize
    : null;
}

function validateZipEntriesSafety(zip: JSZip, maxBackupFiles: number): string | null {
  const names = Object.keys(zip.files);
  if (names.length > maxBackupFiles) {
    return `Archive contains too many entries (${names.length} > ${maxBackupFiles}).`;
  }
  for (const entryPath of names) {
    const entryObj = zip.files[entryPath];
    if (!isSafeArchiveEntryPath(entryPath)) {
      return `Unsafe archive entry path detected: ${entryPath}`;
    }
    const unixMode = typeof entryObj.unixPermissions === "number" ? entryObj.unixPermissions : 0;
    if ((unixMode & 0o170000) === 0o120000) {
      return `Symbolic links are not permitted in backup archives (${entryPath}).`;
    }
  }
  return null;
}

function validateDeclaredArchiveSize(zip: JSZip, maxBytes: number): string | null {
  let declaredBytes = 0;
  for (const entryPath of Object.keys(zip.files)) {
    const entry = zip.files[entryPath];
    if (!entry || entry.dir) continue;
    const size = getZipEntryUncompressedSize(entry);
    if (size === null) continue;
    if (!Number.isSafeInteger(size) || size < 0) return `Invalid ZIP entry size metadata: ${entryPath}`;
    declaredBytes += size;
    if (declaredBytes > maxBytes) return "Expanded backup archive exceeds maximum allowed uncompressed size.";
  }
  return null;
}

async function verifyArchiveManifest(zip: JSZip, jsonStr: string): Promise<string | null> {
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) return null;
  try {
    const manifest = JSON.parse(await manifestFile.async("string")) as Partial<BackupManifest>;
    if (manifest.format && manifest.format !== "kotonoba-backup") {
      return "Unsupported backup manifest format.";
    }
    if (manifest.checksum) {
      const actualDigest = crypto.createHash("sha256").update(jsonStr, "utf8").digest("hex");
      if (actualDigest !== manifest.checksum) {
        return "Backup checksum verification failed; archive may be corrupted or altered.";
      }
    }
    return null;
  } catch {
    return "Invalid manifest.json in backup archive.";
  }
}

export type ParsedBackupZipResult =
  | { ok: true; zip: JSZip; rawData: BackupData; dataBufferLength: number }
  | { ok: false; error: string };

/**
 * Decrypts, parses, verifies manifest SHA-256 checksums, and guards ZIP entry budgets/symlinks.
 */
export async function validateAndParseBackupZip(
  zipBuffer: Buffer,
  envCfg: RuntimeEnvConfig
): Promise<ParsedBackupZipResult> {
  let archiveBuffer = zipBuffer;
  if (isEncryptedBackup(zipBuffer)) {
    try {
      archiveBuffer = decryptBackupArchive(zipBuffer);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Backup decryption failed." };
    }
  } else if (!isLegacyBackupImportEnabled()) {
    return { ok: false, error: "Unencrypted backups are disabled. Upload a .kotonoba-backup file." };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archiveBuffer);
  } catch {
    return { ok: false, error: "Invalid ZIP file format or corrupted archive." };
  }

  const safetyErr = validateZipEntriesSafety(zip, envCfg.maxBackupFiles);
  if (safetyErr) return { ok: false, error: safetyErr };

  const dataFile = zip.file("data.json");
  if (!dataFile) return { ok: false, error: "Archive does not contain a valid 'data.json' file." };

  const dataBuffer = await dataFile.async("nodebuffer");
  if (dataBuffer.length > envCfg.maxBackupJsonBytes) {
    return { ok: false, error: "Backup data.json exceeds maximum permitted size." };
  }

  const jsonStr = dataBuffer.toString("utf8");
  const manifestErr = await verifyArchiveManifest(zip, jsonStr);
  if (manifestErr) return { ok: false, error: manifestErr };

  let rawData: BackupData;
  try {
    rawData = JSON.parse(jsonStr) as BackupData;
  } catch {
    return { ok: false, error: "Failed to parse data.json from backup archive." };
  }

  const sizeErr = validateDeclaredArchiveSize(zip, envCfg.maxBackupUncompressedBytes);
  if (sizeErr) return { ok: false, error: sizeErr };

  return { ok: true, zip, rawData, dataBufferLength: dataBuffer.length };
}
