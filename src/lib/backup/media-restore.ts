import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import type JSZip from "jszip";
import { ensureDir } from "@/lib/utils/fs";
import type { RuntimeEnvConfig } from "@/lib/config/env";
import { createSiteBackupZip } from "./export";
import { isSafeArchiveEntryPath } from "./zip-safety";
import type { AppliedMediaFile, PendingMediaEntry, StagedMediaFile } from "./types";

const MAX_PRE_RESTORE_SNAPSHOTS = 5;

/** Best-effort removal of staging/rollback temporary directories. */
export async function removeDirectoryQuietly(dir: string): Promise<void> {
  try {
    await fs.rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

/** Restores every media destination touched before a failed database transaction. */
export async function rollbackAppliedMedia(
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
      // Keep rolling back remaining files
    }
  }
  await removeDirectoryQuietly(backupRoot);
  await removeDirectoryQuietly(stagingRoot);
}

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
        return { fullPath, mtimeMs: (await fs.stat(/*turbopackIgnore: true*/ fullPath)).mtimeMs };
      })
    );
    dated.sort((a, b) => b.mtimeMs - a.mtimeMs);
    await Promise.all(dated.slice(MAX_PRE_RESTORE_SNAPSHOTS).map((e) => fs.unlink(/*turbopackIgnore: true*/ e.fullPath)));
  } catch {
    // Best-effort retention pruning
  }
}

/** Captures an automatic encrypted snapshot before performing a destructive `replace` restore. */
export async function createPreRestoreSnapshot(
  targetSiteId: string,
  dbPath: string
): Promise<{ ok: true; snapshotPath: string } | { ok: false; error: string }> {
  try {
    const snapshot = await createSiteBackupZip(targetSiteId);
    const snapshotDir = path.join(/*turbopackIgnore: true*/ path.dirname(dbPath), "snapshots");
    ensureDir(snapshotDir);
    const siteKey = targetSiteId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "site";
    const filePath = path.join(/*turbopackIgnore: true*/ snapshotDir, `pre-restore-${siteKey}-${Date.now()}.kotonoba-backup`);
    await fs.writeFile(/*turbopackIgnore: true*/ filePath, snapshot.buffer);
    await prunePreRestoreSnapshots(snapshotDir, siteKey);
    return { ok: true, snapshotPath: filePath };
  } catch {
    return { ok: false, error: "Unable to create pre-restore safety snapshot before replace operation." };
  }
}

/** Validates and collects upload destinations under `sites/<targetSiteId>/`. */
export function collectPendingMediaEntries(
  zip: JSZip,
  siteUploadDir: string,
  sourceSiteId?: string
): { ok: true; entries: PendingMediaEntry[] } | { ok: false; error: string } {
  const entries: PendingMediaEntry[] = [];
  const seenDestinations = new Set<string>();

  for (const entryPath of Object.keys(zip.files)) {
    const zipEntry = zip.files[entryPath];
    if (!zipEntry || zipEntry.dir || !entryPath.startsWith("uploads/")) continue;

    let relPath = entryPath.slice("uploads/".length).replace(/^\/+/, "");
    if (sourceSiteId && relPath.startsWith(`sites/${sourceSiteId}/`)) {
      relPath = relPath.slice(`sites/${sourceSiteId}/`.length);
    }
    if (!relPath || !isSafeArchiveEntryPath(relPath) || relPath.startsWith(".")) continue;

    const destPath = path.resolve(/*turbopackIgnore: true*/ siteUploadDir, relPath);
    if (!destPath.startsWith(siteUploadDir + path.sep)) {
      return { ok: false, error: `Unsafe media destination path in backup: ${relPath}` };
    }

    const destKey = process.platform === "win32" ? destPath.toLowerCase() : destPath;
    if (seenDestinations.has(destKey)) {
      return { ok: false, error: `Duplicate media destination path in backup: ${relPath}` };
    }
    seenDestinations.add(destKey);
    entries.push({ zipEntry, relPath, destPath });
  }

  return { ok: true, entries };
}

/** Streams media entries into a staging directory while enforcing runtime uncompressed size bounds. */
export async function stageBackupMediaFiles(
  pendingMedia: PendingMediaEntry[],
  stagingRoot: string,
  dataBufferLength: number,
  envCfg: RuntimeEnvConfig
): Promise<{ ok: true; staged: StagedMediaFile[] } | { ok: false; error: string }> {
  const staged: StagedMediaFile[] = [];
  let actualMediaBytes = 0;

  try {
    for (const media of pendingMedia) {
      const tempPath = path.join(stagingRoot, media.relPath);
      ensureDir(path.dirname(tempPath));
      await pipeline(media.zipEntry.nodeStream("nodebuffer"), createWriteStream(tempPath));

      const stat = await fs.stat(/*turbopackIgnore: true*/ tempPath);
      if (!stat.isFile()) throw new Error("Extracted media entry is not a regular file.");

      actualMediaBytes += stat.size;
      if (dataBufferLength + actualMediaBytes > envCfg.maxBackupUncompressedBytes) {
        throw new Error("EXPANDED_TOO_LARGE");
      }
      staged.push({ relPath: media.relPath, tempPath, destPath: media.destPath, size: stat.size });
    }
    return { ok: true, staged };
  } catch (err) {
    await removeDirectoryQuietly(stagingRoot);
    return {
      ok: false,
      error:
        err instanceof Error && err.message === "EXPANDED_TOO_LARGE"
          ? "Expanded backup archive exceeds maximum allowed uncompressed size."
          : "Failed to extract backup media safely.",
    };
  }
}

/** Atomically moves staged media into live destinations while tracking rollback backups. */
export async function applyStagedMediaFiles(
  stagedMedia: StagedMediaFile[],
  backupRoot: string,
  stagingRoot: string
): Promise<{ ok: true; applied: AppliedMediaFile[] } | { ok: false; error: string }> {
  const applied: AppliedMediaFile[] = [];
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
      applied.push({ destPath: file.destPath, backupPath });
    }
    return { ok: true, applied };
  } catch {
    await rollbackAppliedMedia(applied, backupRoot, stagingRoot);
    return { ok: false, error: "Failed to write restored media files; no changes were committed." };
  }
}

export function buildTempRestoreRoots(siteUploadDir: string): { stagingRoot: string; backupRoot: string } {
  return {
    stagingRoot: path.join(siteUploadDir, `.restore-staging-${crypto.randomUUID()}`),
    backupRoot: path.join(siteUploadDir, `.restore-backup-${crypto.randomUUID()}`),
  };
}
