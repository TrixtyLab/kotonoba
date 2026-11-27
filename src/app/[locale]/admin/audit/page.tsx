import { requireAdminWorkspace } from "@/lib/admin/page-guard";
import { ROLE_ADMINS } from "@/lib/auth/roles";
import { ROLES } from "@/lib/config/constants";
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

  // A site admin is scoped to their tenant; a super administrator sees the
  // platform-wide trail (each row carries its originating site).
  const isGlobalView = user.role === ROLES.SUPER_ADMIN;
  const logs = listAuditLogsForActor(user, isGlobalView ? null : site.id, 100);
  const formatted = logs.map((entry) => ({
    id: entry.id,
    siteId: entry.siteId,
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

  return <AuditLogClient initialLogs={formatted} showSite={isGlobalView} />;
}
