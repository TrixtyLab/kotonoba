import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessSite } from "@/lib/auth/site-access";
import { canManageBackups } from "@/lib/auth/roles";
import { restoreSiteBackupZip } from "@/lib/backup/import";
import { getEnvConfig } from "@/lib/config/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, getRequestId, isSameOriginRequest } from "@/lib/http/request";
import { recordAuditEvent } from "@/lib/security/audit";
import { logError, logEvent } from "@/lib/observability/logger";

/**
 * HTTP POST endpoint accepting multipart upload of an encrypted `.kotonoba-backup` archive.
 * Enforces CSRF same-origin validation, role and site authorization, size bounds, and audit logging.
 *
 * @param {NextRequest} req - The incoming NextRequest containing the multipart payload.
 * @returns {Promise<NextResponse>} JSON response summarizing restoration entity counts.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "Cross-origin backup import rejected." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || !user.exists || !canManageBackups(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req.headers);
  const rl = checkRateLimit(`backup-import:${user.userId}:${clientIp}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many backup import attempts. Try again shortly." }, { status: 429 });
  }

  let requestedSiteId: string | null = null;
  let mode: "merge" | "replace" = "merge";
  const startedAt = Date.now();
  const requestId = getRequestId(req.headers);

  try {
    const formData = await req.formData();
    const file = (formData.get("backup") || formData.get("file")) as File | null;
    requestedSiteId = formData.get("siteId") as string | null;
    const rawMode = formData.get("mode");
    mode = rawMode === "replace" ? "replace" : "merge";

    if (!file) {
      return NextResponse.json({ error: "No backup archive file provided." }, { status: 400 });
    }

    if (!requestedSiteId) {
      return NextResponse.json({ error: "Target siteId is required." }, { status: 400 });
    }

    if (!canAccessSite(user, requestedSiteId)) {
      recordAuditEvent({
        actorId: user.userId,
        actorEmail: user.email,
        actorRole: user.role,
        siteId: requestedSiteId,
        action: "backup.import",
        targetType: "site",
        targetId: requestedSiteId,
        status: "denied",
        ipAddress: clientIp,
        metadata: { mode },
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".kotonoba-backup") && !lowerName.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Uploaded file must be a .kotonoba-backup archive (legacy .zip requires ALLOW_LEGACY_BACKUP_IMPORT)." },
        { status: 400 }
      );
    }

    const { maxBackupSize } = getEnvConfig();
    if (file.size > maxBackupSize) {
      return NextResponse.json({ error: "Backup archive exceeds the maximum allowed size." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await restoreSiteBackupZip(buffer, requestedSiteId, {
      mode,
      currentUserId: user.userId,
    });

    if (!result.success) {
      recordAuditEvent({
        actorId: user.userId,
        actorEmail: user.email,
        actorRole: user.role,
        siteId: requestedSiteId,
        action: "backup.import",
        targetType: "site",
        targetId: requestedSiteId,
        status: "failure",
        ipAddress: clientIp,
        metadata: { mode, error: result.error },
      });
      logEvent("warn", "backup.import.failed", {
        route: "/api/backup/import",
        requestId,
        siteId: requestedSiteId,
        mode,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ error: result.error || "Failed to restore backup." }, { status: 400 });
    }

    recordAuditEvent({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      siteId: requestedSiteId,
      action: "backup.import",
      targetType: "site",
      targetId: requestedSiteId,
      status: "success",
      ipAddress: clientIp,
      metadata: { mode, stats: result.stats, hasPreRestoreSnapshot: Boolean(result.snapshotPath) },
    });

    logEvent("info", "backup.import.completed", {
      route: "/api/backup/import",
      requestId,
      siteId: requestedSiteId,
      mode,
      durationMs: Date.now() - startedAt,
      hasPreRestoreSnapshot: Boolean(result.snapshotPath),
    });

    return NextResponse.json({
      success: true,
      stats: result.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import backup";
    recordAuditEvent({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      siteId: requestedSiteId,
      action: "backup.import",
      targetType: "site",
      targetId: requestedSiteId,
      status: "failure",
      ipAddress: clientIp,
      metadata: { mode, error: message },
    });
    logError("backup.import.failed", err, {
      route: "/api/backup/import",
      requestId,
      siteId: requestedSiteId ?? undefined,
      mode,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
