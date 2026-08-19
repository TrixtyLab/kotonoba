"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown } from "lucide-react";
import type { SiteOption } from "@/components/admin/UsersManagerClient";

/**
 * Properties configuring the SiteSelect custom dropdown component.
 */
export interface SiteSelectProps {
  /** Label displayed above the select field. */
  label?: string;
  /** Currently selected site identifier or empty string for Global access. */
  value: string;
  /** Callback fired when a site option is selected. */
  onChange: (value: string) => void;
  /** Catalog of available blog sites. */
  availableSites: SiteOption[];
  /** Label for the global access option. */
  globalLabel: string;
  /** Explanatory description for the global access option. */
  globalDesc: string;
  /** Optional helper text displayed below the field. */
  helperText?: string;
  /** Disabled state toggle. */
  disabled?: boolean;
}

/**
 * Custom dropdown select component with checkboxes and scroll for multi-tenant blog assignment.
 *
 * @param props - SiteSelectProps configuring active selection, sites catalog, and labels.
 * @returns React JSX site select element.
 */
export function SiteSelect({
  label,
  value,
  onChange,
  availableSites,
  globalLabel,
  globalDesc,
  helperText,
  disabled = false,
}: SiteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedSite = availableSites.find((s) => s.id === value);
  const isGlobal = value === "";

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
    <div className="w-full space-y-1 text-left" ref={containerRef}>
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
            isOpen
              ? "border-accent ring-1 ring-accent"
              : "border-border hover:border-border-hover"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="truncate font-medium">
              {isGlobal ? globalLabel : selectedSite?.name || globalLabel}
            </span>
            {!isGlobal && selectedSite && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted shrink-0">
                {selectedSite.domain}
              </span>
            )}
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-accent" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-border rounded-xl shadow-xl p-1.5 max-h-60 overflow-y-auto animate-slide-up space-y-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                isGlobal
                  ? "bg-accent/10 border border-accent/30 text-text font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-hover/70 border border-transparent"
              }`}
            >
              <input
                type="checkbox"
                checked={isGlobal}
                readOnly
                className="mt-0.5 rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer shrink-0 pointer-events-none"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
                  <p className="text-xs font-semibold text-text leading-tight truncate">
                    {globalLabel}
                  </p>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                  {globalDesc}
                </p>
              </div>
            </button>

            {availableSites.map((site) => {
              const isSelected = value === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => {
                    onChange(site.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-accent/10 border border-accent/30 text-text font-medium"
                      : "text-text-muted hover:text-text hover:bg-surface-hover/70 border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="mt-0.5 rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer shrink-0 pointer-events-none"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text leading-tight truncate">
                        {site.name}
                      </p>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted shrink-0">
                        {site.domain}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-text-muted mt-0.5 leading-normal">{helperText}</p>
      )}
    </div>
  );
}
