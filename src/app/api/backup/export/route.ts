import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessSite } from "@/lib/auth/site-access";
import { canManageBackups } from "@/lib/auth/roles";
import { createSiteBackupZip } from "@/lib/backup/export";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { recordAuditEvent } from "@/lib/security/audit";

/**
 * HTTP GET endpoint streaming an encrypted backup archive containing the tenant site's
 * database entities, media assets, and integrity manifest metadata.
 *
 * @param {NextRequest} req - The incoming NextRequest containing the target `siteId` query parameter.
 * @returns {Promise<NextResponse>} Binary stream response or 401/403/400/429 error status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists || !canManageBackups(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req.headers);
  const rl = checkRateLimit(`backup-export:${user.userId}:${clientIp}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many backup export requests. Try again shortly." }, { status: 429 });
  }

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "Query parameter 'siteId' is required." }, { status: 400 });
  }

  if (!canAccessSite(user, siteId)) {
    recordAuditEvent({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      siteId,
      action: "backup.export",
      targetType: "site",
      targetId: siteId,
      status: "denied",
      ipAddress: clientIp,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { buffer, filename, manifest } = await createSiteBackupZip(siteId);

    recordAuditEvent({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      siteId,
      action: "backup.export",
      targetType: "site",
      targetId: siteId,
      status: "success",
      ipAddress: clientIp,
      metadata: { filename, counts: manifest.counts },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export backup";
    recordAuditEvent({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      siteId,
      action: "backup.export",
      targetType: "site",
      targetId: siteId,
      status: "failure",
      ipAddress: clientIp,
      metadata: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
