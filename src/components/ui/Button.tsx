"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "glass" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * Modern design-system button supporting variants, loading spinners, and press animations.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", loading = false, disabled, children, icon, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 btn-press disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

    const variants = {
      primary: "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/20",
      secondary: "bg-surface-hover text-text hover:bg-surface border border-border",
      danger: "bg-danger text-white hover:bg-danger-hover shadow-md shadow-danger/20",
      ghost: "text-text-muted hover:text-text hover:bg-surface-hover",
      glass: "bg-surface/80 backdrop-blur-md text-text hover:bg-surface border border-border shadow-sm",
      outline: "border border-border text-text hover:bg-surface-hover",
    };

    const sizes = {
      sm: "text-xs px-2.5 py-1.5 gap-1.5 min-h-[32px]",
      md: "text-sm px-4 py-2 gap-2 min-h-[40px]",
      lg: "text-base px-5 py-2.5 gap-2.5 min-h-[48px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
