import React from "react";

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Leading visual icon or illustration node. */
  icon?: React.ReactNode;
  /** Primary descriptive heading. */
  title: string;
  /** Optional supporting explanation copy. */
  description?: string;
  /** Optional primary CTA button or action bar. */
  action?: React.ReactNode;
  /** Additional utility class overrides. */
  className?: string;
}

/**
 * Shared accessible empty-state card used across admin and public listings.
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`p-10 text-center bg-surface border border-border border-dashed rounded-2xl space-y-3 ${className}`}
    >
      {icon && <div className="mx-auto w-fit text-text-muted/60">{icon}</div>}
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
}
