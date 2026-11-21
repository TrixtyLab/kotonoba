import React from "react";

/** Column header definition for {@link Table}. */
export interface TableColumn {
  key: string;
  label: string;
  className?: string;
}

export interface TableProps {
  columns: TableColumn[];
  children: React.ReactNode;
}

/**
 * Shared responsive table primitive with unified border, surface, and horizontal overflow scrolling.
 */
export function Table({ columns, children }: TableProps): React.JSX.Element {
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
          <tbody className="divide-y divide-border/60 text-text">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
