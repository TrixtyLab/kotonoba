import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, type TableColumn } from "@/components/ui/Table";

/** Column descriptor for {@link AdminDataTable}. */
export type AdminTableColumn = TableColumn;

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
 * Shared responsive administration table shell backed by {@link Table} with empty-state rendering.
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
    <Table columns={columns}>
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
    </Table>
  );
}
