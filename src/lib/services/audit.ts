import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";

/** Serialized audit log item returned to administration views. */
export interface AuditLogRecord {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  siteId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: "success" | "failure" | "denied";
  ipAddress: string | null;
  metadata: string | null;
  createdAt: Date;
}

/**
 * Lists recent security audit events strictly scoped to the caller's tenant boundaries.
 * `admin` users can only inspect logs belonging to their assigned `siteId`, whereas
 * `super_admin` principals may inspect a specific site or platform-wide audit events.
 *
 * @param actor - Authenticated session principal.
 * @param requestedSiteId - Optional site filter (restricted to assigned site for non-super-admins).
 * @param limit - Maximum number of entries to return (1–250, default 100).
 * @returns Reverse-chronological array of audit log records.
 */
export function listAuditLogsForActor(
  actor: Pick<TokenPayload, "role" | "siteId">,
  requestedSiteId?: string | null,
  limit = 100
): AuditLogRecord[] {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const db = getDb();

  if (actor.role === "admin") {
    if (!actor.siteId) {
      return [];
    }
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.siteId, actor.siteId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(safeLimit)
      .all() as AuditLogRecord[];
  }

  const filterSiteId = requestedSiteId?.trim();
  const baseQuery = db.select().from(auditLogs);
  if (filterSiteId) {
    return baseQuery
      .where(and(eq(auditLogs.siteId, filterSiteId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(safeLimit)
      .all() as AuditLogRecord[];
  }

  return baseQuery.orderBy(desc(auditLogs.createdAt)).limit(safeLimit).all() as AuditLogRecord[];
}
