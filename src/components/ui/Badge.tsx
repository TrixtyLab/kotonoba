import React from "react";

/**
 * Visual styling and content properties for the Badge component.
 */
export interface BadgeProps {
  /** Badge content label or children node. */
  children: React.ReactNode;
  /** Color theme variant for semantic highlighting. */
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
  /** Sizing tier. */
  size?: "sm" | "md";
  /** Optional custom CSS class overrides. */
  className?: string;
}

/**
 * Compact pill badge component used for statuses, categories, taxonomy tags, and counter labels.
 *
 * @param props - BadgeProps specifying variant, size, and content.
 * @returns React JSX badge span element.
 */
export function Badge({ children, variant = "primary", size = "sm", className = "" }: BadgeProps) {
  const base = "inline-flex items-center font-semibold rounded-lg tracking-wide select-none";

  const variants = {
    primary: "bg-primary/10 text-primary border border-primary/20",
    secondary: "bg-surface-hover text-text-muted border border-border",
    success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
    outline: "border border-border text-text-muted bg-surface",
  };

  const sizes = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return <span className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>{children}</span>;
}
