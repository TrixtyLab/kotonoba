import React from "react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => string | number;
}

function resolveAlignmentClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

/**
 * Analytics tabular records component backed by the shared {@link AdminDataTable} shell.
 */
export function DataTable<T>({
  columns,
  data,
  emptyMessage = "No records found",
  rowKey = (_row, idx) => idx,
}: DataTableProps<T>): React.JSX.Element {
  const adminColumns: AdminTableColumn[] = columns.map((col) => ({
    key: col.key,
    label: col.header,
    className: `${resolveAlignmentClass(col.align)} ${col.className || ""}`.trim(),
  }));

  return (
    <AdminDataTable
      columns={adminColumns}
      isEmpty={!data || data.length === 0}
      emptyTitle={emptyMessage}
    >
      {data.map((row, idx) => (
        <tr
          key={rowKey(row, idx)}
          className="hover:bg-surface-hover/50 transition-colors group"
        >
          {columns.map((col) => {
            const cellContent = col.render
              ? col.render(row, idx)
              : (row as Record<string, unknown>)[col.key] !== undefined
              ? String((row as Record<string, unknown>)[col.key])
              : "-";

            return (
              <td
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`py-2.5 px-4 font-sans text-xs ${resolveAlignmentClass(col.align)} ${col.className || ""}`.trim()}
              >
                {cellContent}
              </td>
            );
          })}
        </tr>
      ))}
    </AdminDataTable>
  );
}
