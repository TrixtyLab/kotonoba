import React from "react";

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

/**
 * Tabular records grid component with custom render cells, text alignment, and empty states.
 *
 * @template T
 * @param {DataTableProps<T>} props - Column definitions, data items, and rendering options.
 * @returns {React.JSX.Element} Rendered HTML table container.
 */
export function DataTable<T>({
  columns,
  data,
  emptyMessage = "No records found",
  rowKey = (_row, idx) => idx,
}: DataTableProps<T>): React.JSX.Element {
  if (!data || data.length === 0) {
    return (
      <div className="py-12 px-4 text-center text-xs text-text-muted italic bg-surface border border-border rounded-xl">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface shadow-2xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-hover/50 text-text-muted border-b border-border text-[11px] font-semibold uppercase tracking-wider">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`py-2.5 px-4 font-semibold ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                } ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
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
                    className={`py-2.5 px-4 font-sans text-xs ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${col.className || ""}`}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
