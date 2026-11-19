"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

/** Serialized audit log item passed from the Server Component page. */
export interface AuditLogRowItem {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: "success" | "failure" | "denied";
  ipAddress: string | null;
  metadata: string | null;
  createdAtFormatted: string;
}

/** Props for {@link AuditLogClient}. */
export interface AuditLogClientProps {
  initialLogs: AuditLogRowItem[];
}

/**
 * Security and administrative audit trail viewer scoped to authorized administrators.
 */
export function AuditLogClient({ initialLogs }: AuditLogClientProps): React.JSX.Element {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failure" | "denied">("all");

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialLogs.filter((entry) => {
      const statusOk = statusFilter === "all" || entry.status === statusFilter;
      if (!statusOk) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        (entry.actorEmail || "").toLowerCase().includes(q) ||
        (entry.targetId || "").toLowerCase().includes(q) ||
        (entry.ipAddress || "").toLowerCase().includes(q)
      );
    });
  }, [initialLogs, search, statusFilter]);

  const statusOptions = [
    { key: "all" as const, label: tc("all"), count: initialLogs.length },
    { key: "success" as const, label: "OK", count: initialLogs.filter((l) => l.status === "success").length },
    { key: "failure" as const, label: "Fail", count: initialLogs.filter((l) => l.status === "failure").length },
    { key: "denied" as const, label: "Denied", count: initialLogs.filter((l) => l.status === "denied").length },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={tc("audit")}
        subtitle={t("auditDesc")}
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      <div className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t("searchAuditPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-hover/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-muted/50 focus:outline-hidden focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-lg w-full sm:w-auto border border-border/50 overflow-x-auto no-scrollbar">
          {statusOptions.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStatusFilter(st.key)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all shrink-0 whitespace-nowrap ${
                statusFilter === st.key
                  ? "bg-surface text-text shadow-2xs border border-border"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <span>{st.label}</span>
              <span className="text-[10px] text-text-muted opacity-80">({st.count})</span>
            </button>
          ))}
        </div>
      </div>

      <AdminDataTable
        columns={[
          { key: "action", label: t("auditAction") },
          { key: "actor", label: t("auditActor"), className: "hidden sm:table-cell" },
          { key: "target", label: t("auditTarget"), className: "hidden md:table-cell" },
          { key: "status", label: t("auditStatus") },
          { key: "ip", label: t("auditIp"), className: "hidden md:table-cell" },
          { key: "time", label: t("auditTimestamp"), className: "text-right" },
        ]}
        isEmpty={filteredLogs.length === 0}
        emptyIcon={<ShieldCheck className="w-7 h-7" />}
        emptyTitle={t("auditEmpty")}
      >
        {filteredLogs.map((entry) => (
          <tr key={entry.id} className="hover:bg-surface-hover/40 transition-colors">
            <td className="p-3.5 font-mono text-xs font-semibold text-text">
              <div>{entry.action}</div>
              <div className="text-[10px] text-text-muted sm:hidden mt-0.5">{entry.actorEmail || "system"}</div>
            </td>
            <td className="p-3.5 hidden sm:table-cell text-xs">
              <div className="text-text font-medium">{entry.actorEmail || "—"}</div>
              {entry.actorRole && <div className="text-[10px] text-text-muted font-mono">{entry.actorRole}</div>}
            </td>
            <td className="p-3.5 hidden md:table-cell font-mono text-[11px] text-text-muted max-w-xs truncate">
              {entry.targetType ? `${entry.targetType}:${entry.targetId || ""}` : "—"}
            </td>
            <td className="p-3.5">
              <Badge
                variant={
                  entry.status === "success" ? "success" : entry.status === "denied" ? "danger" : "warning"
                }
              >
                {entry.status}
              </Badge>
            </td>
            <td className="p-3.5 hidden md:table-cell font-mono text-[11px] text-text-muted">
              {entry.ipAddress || "—"}
            </td>
            <td className="p-3.5 text-right text-text-muted whitespace-nowrap font-mono text-[11px]">
              {entry.createdAtFormatted}
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}
