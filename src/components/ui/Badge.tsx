import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "primary", size = "sm", className = "" }: BadgeProps) {
  const base = "inline-flex items-center font-medium rounded-full tracking-wide";

  const variants = {
    primary: "bg-primary/15 text-primary border border-primary/30",
    secondary: "bg-surface-hover text-text-muted border border-border",
    success: "bg-success/15 text-success border border-success/30",
    warning: "bg-warning/15 text-warning border border-warning/30",
    danger: "bg-danger/15 text-danger border border-danger/30",
    outline: "border border-border text-text-muted",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return <span className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>{children}</span>;
}
