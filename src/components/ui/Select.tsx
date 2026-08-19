"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Option item definition for custom select dropdowns.
 */
export interface SelectOption {
  /** Machine-readable value identifier. */
  value: string;
  /** Human-readable display label. */
  label: string;
  /** Optional icon element displayed adjacent to label. */
  icon?: React.ReactNode;
  /** Subordinate description text. */
  description?: string;
}

/**
 * Properties configuring the Select dropdown component.
 */
export interface SelectProps {
  /** Optional label text displayed above the control. */
  label?: string;
  /** Currently selected option value. */
  value: string;
  /** Callback fired when an option is selected. */
  onChange: (value: string) => void;
  /** Available selectable options array. */
  options: SelectOption[];
  /** Placeholder text shown when value is unselected. */
  placeholder?: string;
  /** Disables user interaction when true. */
  disabled?: boolean;
  /** Validation error message string. */
  error?: string;
  /** Helper explanation text. */
  helperText?: string;
  /** Optional custom CSS classes. */
  className?: string;
}

/**
 * Accessible custom select dropdown component with keyboard interaction and outside click detection.
 *
 * @param props - SelectProps configuring choices, current value, label, and event handlers.
 * @returns React JSX select dropdown container element.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled = false,
  error,
  helperText,
  className = "",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`w-full space-y-1 text-left ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-text select-none">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border bg-input text-text transition-all select-none cursor-pointer ${
            error
              ? "border-danger ring-1 ring-danger"
              : isOpen
              ? "border-accent ring-1 ring-accent"
              : "border-border hover:border-border-hover"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {selectedOption?.icon && (
              <span className="shrink-0 text-accent">{selectedOption.icon}</span>
            )}
            <span className={`truncate ${selectedOption ? "font-medium" : "text-text-muted"}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-accent" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-1 max-h-56 overflow-y-auto animate-slide-up">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent text-white font-medium shadow-xs"
                      : "text-text hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.icon && (
                      <span className={`shrink-0 ${isSelected ? "text-white" : "text-accent"}`}>
                        {opt.icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate leading-tight">{opt.label}</p>
                      {opt.description && (
                        <p className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-white/80" : "text-text-muted"}`}>
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-danger font-medium mt-0.5">{error}</p>}
      {helperText && !error && <p className="text-[11px] text-text-muted mt-0.5 leading-normal">{helperText}</p>}
    </div>
  );
}
