"use client";

import React from "react";
import { Check } from "lucide-react";

/**
 * Properties configuring the custom Checkbox component.
 */
export interface CheckboxProps {
  /** Current checked boolean state. */
  checked: boolean;
  /** Callback fired when checked state toggles. */
  onChange: (checked: boolean) => void;
  /** Label content node or string. */
  label?: React.ReactNode;
  /** Subordinate description text. */
  description?: string;
  /** Disables user interaction when true. */
  disabled?: boolean;
  /** Error message string. */
  error?: string;
  /** Optional custom CSS classes. */
  className?: string;
  /** HTML identifier. */
  id?: string;
}

/**
 * Modern custom styled checkbox with accessible focus rings and label alignment.
 *
 * @param props - CheckboxProps configuring checked status, label, and event handlers.
 * @returns React JSX checkbox container element.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  error,
  className = "",
  id,
}: CheckboxProps) {
  const checkboxId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`flex items-start gap-2.5 select-none ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"} ${className}`}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${
            checked
              ? "bg-accent border-accent text-white shadow-2xs"
              : "bg-input border-border hover:border-border-hover"
          } ${error ? "border-danger ring-1 ring-danger" : ""}`}
        >
          {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
        </button>
      </div>

      {(label || description) && (
        <div
          className="min-w-0 flex-1 text-left cursor-pointer"
          onClick={() => !disabled && onChange(!checked)}
        >
          {label && (
            <label htmlFor={checkboxId} className="block text-xs font-semibold text-text cursor-pointer leading-tight">
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-text-muted mt-0.5 leading-normal">
              {description}
            </p>
          )}
          {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
        </div>
      )}
    </div>
  );
}
