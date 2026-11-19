import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessSite } from "@/lib/auth/site-access";
import { canManageSettings, ROLE_ALL, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { getAdminSite } from "@/lib/tenant";
import { getEnvConfig } from "@/lib/config/env";
import { getClientIp, isSameOriginRequest } from "@/lib/http/request";
import { recordAuditEvent } from "@/lib/security/audit";
import {
  listMediaFiles,
  deleteFromStorage,
  createFolder,
  moveMediaItem,
  getStorageStatus,
  getSiteStorageUsageBytes,
  cleanupOrphanMedia,
} from "@/lib/storage";

const READ_MEDIA_ROLES = new Set<string>(ROLE_ALL);
const MANAGE_MEDIA_ROLES = new Set<string>(ROLE_PUBLISHERS);

async function resolveMediaSiteId(
  user: { role: string; siteId: string | null },
  requestedSiteId?: string | null
): Promise<{ ok: true; siteId: string } | { ok: false; status: number; error: string }> {
  if (requestedSiteId) {
    if (!canAccessSite(user, requestedSiteId)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return { ok: true, siteId: requestedSiteId };
  }

  const activeSite = await getAdminSite();
  const resolved = activeSite?.id || user.siteId;
  if (!resolved) {
    return { ok: false, status: 400, error: "Active site context is required" };
  }
  return { ok: true, siteId: resolved };
}

/**
 * HTTP GET handler retrieving tenant-scoped directory listings of media assets and subfolders.
 *
 * @param req - The incoming NextRequest containing optional `folder` and `siteId` parameters.
 * @returns JSON listing of files, folders, and storage backend status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!READ_MEDIA_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder") || "";
  const siteScope = await resolveMediaSiteId(user, searchParams.get("siteId"));
  if (!siteScope.ok) {
    return NextResponse.json({ error: siteScope.error }, { status: siteScope.status });
  }

  try {
    const listing = await listMediaFiles(folder, siteScope.siteId);
    const status = getStorageStatus(siteScope.siteId);
    const usedBytes = await getSiteStorageUsageBytes(siteScope.siteId);
    const { maxSiteStorageBytes } = getEnvConfig();

    return NextResponse.json({
      success: true,
      currentFolder: listing.currentFolder,
      parentFolder: listing.parentFolder,
      folders: listing.folders,
      files: listing.files,
      storage: {
        ...status,
        usedBytes,
        quotaBytes: maxSiteStorageBytes,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch media";
    const status = message === "FORBIDDEN_MEDIA_PATH" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * HTTP POST handler executing media actions (`createFolder`, `move`) scoped to the active tenant.
 * Restricted to editorial and administrative roles.
 *
 * @param req - The incoming NextRequest containing action payload.
 * @returns JSON operation status.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!MANAGE_MEDIA_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const siteScope = await resolveMediaSiteId(user, typeof body?.siteId === "string" ? body.siteId : null);
    if (!siteScope.ok) {
      return NextResponse.json({ error: siteScope.error }, { status: siteScope.status });
    }

    const { action } = body;

    if (action === "createFolder") {
      const { folderName, parentFolder } = body;
      if (!folderName || typeof folderName !== "string") {
        return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
      }
      const success = await createFolder(folderName, typeof parentFolder === "string" ? parentFolder : "", siteScope.siteId);
      if (!success) {
        return NextResponse.json({ error: "Failed to create folder" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "move") {
      const { itemPath, targetFolder } = body;
      if (!itemPath || typeof itemPath !== "string") {
        return NextResponse.json({ error: "Item path is required" }, { status: 400 });
      }
      const success = await moveMediaItem(itemPath, typeof targetFolder === "string" ? targetFolder : "", siteScope.siteId);
      if (!success) {
        return NextResponse.json({ error: "Failed to move item" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "cleanupOrphans") {
      if (!canManageSettings(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const gracePeriodMs =
        typeof body?.gracePeriodMs === "number" && Number.isFinite(body.gracePeriodMs)
          ? Math.max(0, body.gracePeriodMs)
          : undefined;
      const summary = await cleanupOrphanMedia(siteScope.siteId, { gracePeriodMs });
      recordAuditEvent({
        actorId: user.userId,
        actorEmail: user.email,
        actorRole: user.role,
        siteId: siteScope.siteId,
        action: "media.cleanup_orphans",
        targetType: "media",
        targetId: siteScope.siteId,
        ipAddress: getClientIp(req.headers),
        metadata: {
          deletedCount: summary.deletedCount,
          freedBytes: summary.freedBytes,
        },
      });
      return NextResponse.json({ success: true, ...summary });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Media operation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * HTTP DELETE handler removing media files or folders within the active tenant directory.
 * Restricted to editorial and administrative roles.
 *
 * @param req - The incoming NextRequest specifying `path` and optional `isFolder`.
 * @returns JSON deletion outcome.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!MANAGE_MEDIA_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const siteScope = await resolveMediaSiteId(user, typeof body?.siteId === "string" ? body.siteId : null);
    if (!siteScope.ok) {
      return NextResponse.json({ error: siteScope.error }, { status: siteScope.status });
    }

    const itemPath = body.path || body.filename;
    const isFolder = Boolean(body.isFolder);

    if (!itemPath || typeof itemPath !== "string") {
      return NextResponse.json({ error: "Item path is required" }, { status: 400 });
    }

    const success = await deleteFromStorage(itemPath, isFolder, siteScope.siteId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete item" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete media item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
