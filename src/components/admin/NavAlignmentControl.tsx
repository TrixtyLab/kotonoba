"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

interface NavAlignmentControlProps {
  alignment: "left" | "center" | "right";
  onChangeAlignment: (next: "left" | "center" | "right") => void;
}

/**
 * Segmented alignment control for top header navigation links (`left`, `center`, `right`).
 */
export function NavAlignmentControl({
  alignment,
  onChangeAlignment,
}: NavAlignmentControlProps) {
  const t = useTranslations("settings");

  const options: Array<{
    value: "left" | "center" | "right";
    label: string;
    Icon: typeof AlignLeft;
  }> = [
    { value: "left", label: t("alignLeft"), Icon: AlignLeft },
    { value: "center", label: t("alignCenter"), Icon: AlignCenter },
    { value: "right", label: t("alignRight"), Icon: AlignRight },
  ];

  return (
    <div className="bg-surface-hover/30 border border-border rounded-xl p-5 space-y-3.5 shadow-xs">
      <div>
        <h3 className="text-sm font-bold text-text">{t("navAlignment")}</h3>
        <p className="text-xs text-text-muted mt-0.5">{t("navigationDesc")}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-sm pt-1">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChangeAlignment(value)}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              alignment === value
                ? "border-accent bg-accent/10 text-accent shadow-xs"
                : "border-border bg-surface hover:bg-surface-hover text-text-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
