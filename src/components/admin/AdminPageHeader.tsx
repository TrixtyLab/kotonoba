import React from "react";

/** Props for {@link AdminPageHeader}. */
export interface AdminPageHeaderProps {
  /** Page title heading. */
  title: string;
  /** Optional subtitle explaining the page scope. */
  subtitle?: string;
  /** Optional icon rendered alongside the title. */
  icon?: React.ReactNode;
  /** Optional trailing toolbar buttons or controls. */
  actions?: React.ReactNode;
}

/**
 * Standardized administration workspace header bar.
 */
export function AdminPageHeader({ title, subtitle, icon, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
      <div className="space-y-0.5 min-w-0">
        <h1 className="text-lg font-bold text-text flex items-center gap-2 truncate">
          {icon && <span className="text-accent shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
