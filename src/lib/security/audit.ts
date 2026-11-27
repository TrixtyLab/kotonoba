import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/slug";

/**
 * Outcome status recorded for an audited action.
 */
export type AuditStatus = "success" | "failure" | "denied";

/**
 * Structured security audit event payload.
 */
export interface AuditEventInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  siteId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  status?: AuditStatus;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Emits a structured security audit event to both the `audit_logs` database table
 * and structured JSON logs without ever storing secret material.
 *
 * @param event - Security audit event metadata.
 */
export function recordAuditEvent(event: AuditEventInput): void {
  const createdAt = new Date();
  const safeMetadata = event.metadata ? JSON.stringify(event.metadata) : "{}";
  const status: AuditStatus = event.status ?? "success";

  console.info(
    JSON.stringify({
      type: "audit",
      timestamp: createdAt.toISOString(),
      action: event.action,
      status,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      siteId: event.siteId ?? null,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      ipAddress: event.ipAddress ?? null,
    })
  );

  try {
    const db = getDb();
    db.insert(auditLogs)
      .values({
        id: generateId(),
        actorId: event.actorId ?? null,
        actorEmail: event.actorEmail ?? null,
        actorRole: event.actorRole ?? null,
        siteId: event.siteId ?? null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId ?? null,
        status,
        ipAddress: event.ipAddress ?? null,
        metadata: safeMetadata,
        createdAt,
      })
      .run();
  } catch {
    // Audit DB persistence must never crash an operation if storage is read-only or shutting down.
  }
}
