"use client";

import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Accessible toggle switch primitive for boolean feature and integration settings.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: SwitchProps): React.JSX.Element {
  const generatedId = React.useId();
  const controlId = id || generatedId;

  return (
    <label
      htmlFor={controlId}
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent/40 ${
          checked
            ? "bg-accent border-accent"
            : "bg-surface-hover border-border"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-2xs transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-xs font-medium text-text">{label}</span>}
          {description && <span className="text-[11px] text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
