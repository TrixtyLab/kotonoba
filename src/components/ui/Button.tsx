"use client";

import React, { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

/**
 * Visual styling and state configuration properties for the Button component.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual theme variant determining background and border styling. */
  variant?: "primary" | "secondary" | "danger" | "ghost" | "glass" | "outline" | "accent";
  /** Sizing tier for height, padding, and font size. */
  size?: "sm" | "md" | "lg";
  /** Shows a loading spinner and disables interaction when true. */
  loading?: boolean;
  /** Leading or trailing icon node. */
  icon?: React.ReactNode;
}

/**
 * Universal polymorphic interactive button component supporting design tokens, loading spinners, and variant styling.
 *
 * @param props - ButtonProps configuring appearance, size, loading state, and HTML attributes.
 * @param ref - Forwarded DOM ref to the underlying HTMLButtonElement.
 * @returns React JSX button element.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", loading = false, disabled, children, icon, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent select-none";

    const variants = {
      primary: "bg-primary text-bg hover:opacity-90 font-semibold shadow-xs",
      secondary: "bg-surface-hover text-text hover:bg-surface-hover/80 border border-border",
      accent: "bg-accent text-white hover:bg-accent-hover font-semibold shadow-xs",
      danger: "bg-danger text-white hover:bg-danger-hover font-semibold shadow-xs",
      ghost: "text-text-muted hover:text-text hover:bg-surface-hover",
      glass: "bg-surface/80 backdrop-blur-md text-text hover:bg-surface border border-border shadow-xs",
      outline: "border border-border bg-surface text-text hover:bg-surface-hover font-medium",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 gap-1.5 min-h-[32px]",
      md: "text-xs px-3.5 py-2 gap-2 min-h-[36px]",
      lg: "text-sm px-4 py-2.5 gap-2.5 min-h-[42px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
