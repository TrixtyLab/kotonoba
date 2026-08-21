"use client";

import React, { useId } from "react";
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
 * Modern custom styled checkbox with accessible focus rings and reliable full-label click toggling.
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
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 select-none cursor-pointer group ${
        disabled ? "opacity-50 pointer-events-none cursor-not-allowed" : ""
      } ${className}`}
    >
      <div className="relative flex items-center justify-center mt-0.5 shrink-0">
        <input
          type="checkbox"
          id={inputId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          aria-hidden="true"
          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
            checked
              ? "bg-accent border-accent text-white shadow-2xs"
              : "bg-input border-border group-hover:border-border-hover"
          } ${error ? "border-danger ring-1 ring-danger" : ""}`}
        >
          {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
        </div>
      </div>

      {(label || description) && (
        <div className="min-w-0 flex-1 text-left">
          {label && (
            <span className="block text-xs font-semibold text-text leading-tight group-hover:text-text cursor-pointer">
              {label}
            </span>
          )}
          {description && (
            <p className="text-[11px] text-text-muted mt-0.5 leading-normal cursor-pointer">
              {description}
            </p>
          )}
          {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
        </div>
      )}
    </label>
  );
}

