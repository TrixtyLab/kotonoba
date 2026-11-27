"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useTranslations } from "next-intl";

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

function nextHighlight(current: number, key: string, length: number): number | null {
  if (length === 0) return null;
  if (key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowUp") return (current - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

function SelectOptionsDropdown({
  options,
  value,
  highlight,
  listId,
  onHighlight,
  onSelect,
}: {
  options: SelectOption[];
  value: string;
  highlight: number;
  listId: string;
  onHighlight: (index: number) => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      id={listId}
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-1 max-h-56 overflow-y-auto"
    >
      {options.map((opt, index) => {
        const isSelected = opt.value === value;
        const isHighlighted = index === highlight;
        return (
          <button
            key={opt.value}
            id={`${listId}-opt-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => onHighlight(index)}
            onClick={() => onSelect(opt.value)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] text-sm rounded-lg text-left transition-colors cursor-pointer ${
              isSelected
                ? "bg-accent text-white font-medium"
                : isHighlighted
                  ? "bg-surface-hover text-text"
                  : "text-text hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {opt.icon && (
                <span className={`shrink-0 ${isSelected ? "text-white" : "text-accent"}`}>{opt.icon}</span>
              )}
              <div className="min-w-0">
                <p className="truncate leading-tight">{opt.label}</p>
                {opt.description && (
                  <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-white/80" : "text-text-muted"}`}>
                    {opt.description}
                  </p>
                )}
              </div>
            </div>
            {isSelected && <Check className="w-4 h-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function clampHighlight(highlight: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(highlight, length - 1);
}

function feedbackDescribedBy(
  error: string | undefined,
  helperText: string | undefined,
  errorId: string,
  helperId: string
): string | undefined {
  if (error) return errorId;
  if (helperText) return helperId;
  return undefined;
}

function onSelectKeyDown(
  event: React.KeyboardEvent<HTMLButtonElement>,
  ctx: {
    disabled: boolean;
    isOpen: boolean;
    highlight: number;
    options: SelectOption[];
    onOpen: () => void;
    onClose: () => void;
    onHighlight: (index: number) => void;
    onCommit: (value: string) => void;
  }
): void {
  if (ctx.disabled) return;
  const moved = nextHighlight(ctx.highlight, event.key, ctx.options.length);
  if (moved !== null) {
    event.preventDefault();
    if (ctx.isOpen) ctx.onHighlight(moved);
    else ctx.onOpen();
    return;
  }
  if (event.key === "Escape") {
    ctx.onClose();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (!ctx.isOpen) {
    ctx.onOpen();
    return;
  }
  const option = ctx.options[ctx.highlight];
  if (option) ctx.onCommit(option.value);
}

function SelectTrigger({
  buttonId,
  listId,
  isOpen,
  disabled,
  borderClass,
  describedBy,
  activeDescendant,
  selectedOption,
  placeholder,
  onClick,
  onKeyDown,
}: {
  buttonId: string;
  listId: string;
  isOpen: boolean;
  disabled: boolean;
  borderClass: string;
  describedBy?: string;
  activeDescendant?: string;
  selectedOption?: SelectOption;
  placeholder: string;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const valueClass = selectedOption ? "font-medium" : "text-text-muted";
  const stateClass = disabled ? "opacity-50 cursor-not-allowed" : "";
  const chevronClass = isOpen ? "rotate-180 text-accent" : "";

  return (
    <button
      id={buttonId}
      type="button"
      role="combobox"
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={listId}
      aria-describedby={describedBy}
      aria-activedescendant={activeDescendant}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] text-sm rounded-lg border bg-input text-text transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${borderClass} ${stateClass}`}
    >
      <div className="flex items-center gap-2 min-w-0 truncate">
        {selectedOption?.icon && <span className="shrink-0 text-accent">{selectedOption.icon}</span>}
        <span className={`truncate ${valueClass}`}>{selectedOption?.label ?? placeholder}</span>
      </div>
      <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-150 ${chevronClass}`} />
    </button>
  );
}

function resolveSelectTriggerBorder(error: string | undefined, isOpen: boolean): string {
  if (error) return "border-danger ring-1 ring-danger";
  if (isOpen) return "border-accent ring-1 ring-accent";
  return "border-border hover:border-border-hover";
}

function SelectFieldFeedback({
  error,
  helperText,
  errorId,
  helperId,
}: {
  error?: string;
  helperText?: string;
  errorId: string;
  helperId: string;
}) {
  if (error) return <p id={errorId} className="text-xs text-danger font-medium mt-0.5">{error}</p>;
  if (helperText) return <p id={helperId} className="text-xs text-text-muted mt-0.5 leading-normal">{helperText}</p>;
  return null;
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
  placeholder,
  disabled = false,
  error,
  helperText,
  className = "",
}: SelectProps) {
  const t = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const buttonId = useId();
  const errorId = `${buttonId}-error`;
  const helperId = `${buttonId}-helper`;
  const selectedOption = options.find((opt) => opt.value === value);
  const resolvedPlaceholder = placeholder ?? t("selectPlaceholder");
  const safeHighlight = clampHighlight(highlight, options.length);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function openAtSelection() {
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }

  function commitValue(next: string) {
    onChange(next);
    setIsOpen(false);
  }

  const borderClass = resolveSelectTriggerBorder(error, isOpen);
  const describedBy = feedbackDescribedBy(error, helperText, errorId, helperId);

  return (
    <div className={`w-full space-y-1 text-left ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={buttonId} className="block text-xs font-semibold text-text">
          {label}
        </label>
      )}

      <div className="relative">
        <SelectTrigger
          buttonId={buttonId}
          listId={listId}
          isOpen={isOpen}
          disabled={disabled}
          borderClass={borderClass}
          describedBy={describedBy}
          activeDescendant={isOpen ? `${listId}-opt-${safeHighlight}` : undefined}
          selectedOption={selectedOption}
          placeholder={resolvedPlaceholder}
          onClick={() => {
            if (disabled) return;
            if (isOpen) setIsOpen(false);
            else openAtSelection();
          }}
          onKeyDown={(event) =>
            onSelectKeyDown(event, {
              disabled,
              isOpen,
              highlight: safeHighlight,
              options,
              onOpen: openAtSelection,
              onClose: () => setIsOpen(false),
              onHighlight: setHighlight,
              onCommit: commitValue,
            })
          }
        />

        {isOpen && (
          <SelectOptionsDropdown
            options={options}
            value={value}
            highlight={safeHighlight}
            listId={listId}
            onHighlight={setHighlight}
            onSelect={commitValue}
          />
        )}
      </div>

      <SelectFieldFeedback error={error} helperText={helperText} errorId={errorId} helperId={helperId} />
    </div>
  );
}
