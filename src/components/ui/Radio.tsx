"use client";

import React from "react";

/**
 * Option definition within a RadioGroup.
 */
export interface RadioOption {
  /** Value string of the radio option. */
  value: string;
  /** Primary label text. */
  label: string;
  /** Secondary explanatory text. */
  description?: string;
  /** Optional icon node. */
  icon?: React.ReactNode;
}

/**
 * Properties configuring the RadioGroup component.
 */
export interface RadioGroupProps {
  /** Label header above the radio group. */
  label?: string;
  /** Currently selected value. */
  value: string;
  /** Callback fired on selection change. */
  onChange: (value: string) => void;
  /** Available choices. */
  options: RadioOption[];
  /** Disables user interaction. */
  disabled?: boolean;
  /** Layout mode: 'cards' for large visual blocks, 'horizontal', or 'vertical'. */
  layout?: "horizontal" | "vertical" | "cards";
  /** Validation error message string. */
  error?: string;
  /** Helper text. */
  helperText?: string;
  /** Optional custom CSS classes. */
  className?: string;
}

/**
 * Multi-option radio selection group supporting card grids, horizontal inline pills, and vertical list layouts.
 *
 * @param props - RadioGroupProps configuring options, active selection, and layout mode.
 * @returns React JSX radio group container element.
 */
export function RadioGroup({
  label,
  value,
  onChange,
  options,
  disabled = false,
  layout = "cards",
  error,
  helperText,
  className = "",
}: RadioGroupProps) {
  return (
    <div className={`w-full space-y-1.5 text-left select-none ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-text">
          {label}
        </label>
      )}

      {layout === "cards" && (
        <div className="grid grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent text-text shadow-2xs"
                    : "border-border bg-surface hover:bg-surface-hover/60 text-text-muted hover:text-text"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "border-accent bg-accent" : "border-border bg-input"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-text">
                    {opt.icon && <span className="text-accent">{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </div>
                  {opt.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 leading-tight">
                      {opt.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {layout !== "cards" && (
        <div className={`flex ${layout === "vertical" ? "flex-col space-y-2" : "flex-row flex-wrap gap-4"}`}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 cursor-pointer text-xs ${
                  disabled ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => onChange(opt.value)}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "border-accent bg-accent" : "border-border bg-input"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className={`font-medium ${isSelected ? "text-text font-semibold" : "text-text-muted"}`}>
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-text-muted mt-0.5 leading-normal">{helperText}</p>}
    </div>
  );
}
