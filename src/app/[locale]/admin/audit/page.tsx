import { requireAdminWorkspace } from "@/lib/admin/page-guard";
import { ROLE_ADMINS } from "@/lib/auth/roles";
import { listAuditLogsForActor } from "@/lib/services/audit";
import { AuditLogClient } from "@/components/admin/AuditLogClient";
import { formatDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

/**
 * Protected administration page displaying tenant-scoped security audit trail events.
 */
export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { user, site } = await requireAdminWorkspace({ locale, allowedRoles: ROLE_ADMINS });

  const logs = listAuditLogsForActor(user, site.id, 100);
  const formatted = logs.map((entry) => ({
    id: entry.id,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    status: entry.status,
    ipAddress: entry.ipAddress,
    metadata: entry.metadata,
    createdAtFormatted: formatDate(entry.createdAt, locale),
  }));

  return <AuditLogClient initialLogs={formatted} />;
}
