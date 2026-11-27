"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Globe, CheckCircle2 } from "lucide-react";
import type { SiteLanguageOption } from "@/components/admin/settings/SiteTranslationsSection";

interface SupportedLocalesSectionProps {
  availableLanguages: SiteLanguageOption[];
  selectedLocales: string[];
  onToggleLocale: (code: string) => void;
}

/**
 * Checkbox grid enabling or disabling public language switchers for the blog tenant.
 */
export function SupportedLocalesSection({
  availableLanguages,
  selectedLocales,
  onToggleLocale,
}: SupportedLocalesSectionProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  return (
    <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-bold text-text flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent" />
          <span>{t("visibleLanguages")}</span>
        </h3>
        <p className="text-xs text-text-muted mt-0.5">{t("visibleLanguagesDesc")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
        {availableLanguages.map((lang) => {
          const isChecked = selectedLocales.includes(lang.code);
          return (
            <label
              key={lang.code}
              className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                isChecked
                  ? "border-accent bg-accent/5 text-text shadow-2xs"
                  : "border-border bg-surface-hover/20 text-text-muted hover:border-border-hover hover:text-text"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleLocale(lang.code)}
                className="rounded border-border text-accent focus:ring-accent w-4 h-4"
              />
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="text-xs font-medium flex-1">{lang.label}</span>
              {lang.code === "en" && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                  {tc("default")}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {selectedLocales.length === 1 && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2 text-xs text-accent">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {t("onlyOneLanguageActive", {
              lang: availableLanguages.find((l) => l.code === selectedLocales[0])?.label || "English",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
