"use client";

import React from "react";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
  variant?: "surface" | "pills";
}

/**
 * Shared accessible horizontal tab strip primitive for filter toolbars and sub-navigation bars.
 */
export function Tabs({
  items,
  activeKey,
  onSelect,
  ariaLabel,
  variant = "surface",
}: TabsProps): React.JSX.Element {
  const containerClass =
    variant === "surface"
      ? "flex flex-wrap items-center gap-1 bg-surface-hover/60 p-1 rounded-lg w-full sm:w-auto border border-border/50"
      : "flex items-center gap-1 overflow-x-auto no-scrollbar";

  return (
    <div role="tablist" aria-label={ariaLabel} className={containerClass}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const buttonClass =
          variant === "surface"
            ? isActive
              ? "bg-surface text-text shadow-2xs border border-border"
              : "text-text-muted hover:text-text"
            : isActive
            ? "bg-accent/10 text-accent font-semibold"
            : "text-text-muted hover:text-text hover:bg-surface-hover";

        const idleBorder = variant === "surface" && !isActive ? "border border-transparent" : "";

        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-sm font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 cursor-pointer ${idleBorder} ${buttonClass}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span className="text-[10px] opacity-80">({item.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
