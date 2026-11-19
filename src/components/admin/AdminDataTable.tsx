import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Column descriptor for {@link AdminDataTable}. */
export interface AdminTableColumn {
  key: string;
  label: string;
  className?: string;
}

/** Props for {@link AdminDataTable}. */
export interface AdminDataTableProps {
  columns: AdminTableColumn[];
  isEmpty: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

/**
 * Shared responsive administration table shell with unified styling and empty-state rendering.
 */
export function AdminDataTable({
  columns,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  children,
}: AdminDataTableProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-hover/50 text-text-muted border-b border-border font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-3.5 ${col.className || ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-text">
            {isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="p-6">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="border-0 bg-transparent p-6"
                  />
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
