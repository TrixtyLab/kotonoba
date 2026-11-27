import path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { getEnvConfig, getRuntimeUploadDir } from "@/lib/config/env";
import { executeBackupDbTransaction } from "./db-restore";
import {
  applyStagedMediaFiles,
  buildTempRestoreRoots,
  collectPendingMediaEntries,
  createPreRestoreSnapshot,
  removeDirectoryQuietly,
  rollbackAppliedMedia,
  stageBackupMediaFiles,
} from "./media-restore";
import { emptyStats, type RestoreOptions, type RestoreResult } from "./types";
import { validateAndParseBackupZip } from "./zip-safety";

/**
 * Rejects restores that would cross tenant boundaries unless the caller explicitly allows it.
 *
 * @param sourceSiteId - Site recorded inside the archive manifest.
 * @param targetSiteId - Site receiving the restore.
 * @param options - Restore options including the cross-site override.
 * @returns Human-readable denial reason, or `null` when the restore is permitted.
 */
function resolveCrossSiteRestoreError(
  sourceSiteId: string | undefined,
  targetSiteId: string,
  options: RestoreOptions
): string | null {
  if (options.allowCrossSite) return null;
  if (sourceSiteId === targetSiteId) return null;
  return sourceSiteId
    ? "Only super administrators can restore a backup exported from another site."
    : "This backup does not identify its source site; only super administrators can restore it.";
}

/**
 * Restores a tenant site's database records and media assets from an encrypted Kotonoba backup archive.
 */
export async function restoreSiteBackupZip(
  zipBuffer: Buffer,
  targetSiteId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  const db = getDb();
  const envCfg = getEnvConfig();

  const targetSite = db.select().from(sites).where(eq(sites.id, targetSiteId)).get();
  if (!targetSite) {
    return { success: false, stats: emptyStats(), error: `Target site with ID "${targetSiteId}" does not exist.` };
  }

  const parsed = await validateAndParseBackupZip(zipBuffer, envCfg);
  if (!parsed.ok) return { success: false, stats: emptyStats(), error: parsed.error };

  const sourceSiteId = parsed.rawData.site?.id;
  const crossSiteError = resolveCrossSiteRestoreError(sourceSiteId, targetSiteId, options);
  if (crossSiteError) {
    return { success: false, stats: emptyStats(), sourceSiteId, error: crossSiteError };
  }

  const uploadDir = getRuntimeUploadDir();
  const siteUploadDir = path.resolve(/*turbopackIgnore: true*/ uploadDir, "sites", targetSiteId);
  const pendingResult = collectPendingMediaEntries(parsed.zip, siteUploadDir, parsed.rawData.site?.id);
  if (!pendingResult.ok) return { success: false, stats: emptyStats(), error: pendingResult.error };

  let snapshotPath: string | undefined;
  if (options.mode === "replace") {
    const snap = await createPreRestoreSnapshot(targetSiteId, envCfg.dbPath);
    if (!snap.ok) return { success: false, stats: emptyStats(), error: snap.error };
    snapshotPath = snap.snapshotPath;
  }

  const { stagingRoot, backupRoot } = buildTempRestoreRoots(siteUploadDir);
  const stageResult = await stageBackupMediaFiles(pendingResult.entries, stagingRoot, parsed.dataBufferLength, envCfg);
  if (!stageResult.ok) return { success: false, stats: emptyStats(), error: stageResult.error };

  const applyResult = await applyStagedMediaFiles(stageResult.staged, backupRoot, stagingRoot);
  if (!applyResult.ok) return { success: false, stats: emptyStats(), error: applyResult.error };

  const stats = emptyStats();
  try {
    executeBackupDbTransaction(db, targetSite, parsed.rawData, options, stats);
  } catch (err) {
    console.error("[backup/import] Database transaction failed; restoring previous media:", err instanceof Error ? err.message : err);
    await rollbackAppliedMedia(applyResult.applied, backupRoot, stagingRoot);
    return {
      success: false,
      stats: emptyStats(),
      error: "Failed to restore backup transaction; no database or media changes were committed.",
    };
  }

  await removeDirectoryQuietly(stagingRoot);
  await removeDirectoryQuietly(backupRoot);
  stats.media = stageResult.staged.length;

  return { success: true, stats, snapshotPath, sourceSiteId };
}
