"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Trash2 } from "lucide-react";

export interface AdditionalTranslation {
  code: string;
  name: string;
  subtitle: string;
  description: string;
}

export interface SiteLanguageOption {
  code: string;
  label: string;
  flag: string;
}

interface SiteTranslationsSectionProps {
  availableLanguages: SiteLanguageOption[];
  unusedLanguages: SiteLanguageOption[];
  translations: AdditionalTranslation[];
  addLangCode: string;
  defaultName: string;
  defaultSubtitle: string;
  defaultDescription: string;
  onChangeAddLangCode: (code: string) => void;
  onAddTranslation: () => void;
  onRemoveTranslation: (code: string) => void;
  onUpdateTranslation: (code: string, field: keyof AdditionalTranslation, value: string) => void;
}

/**
 * Repeatable multilingual branding card list for additional translated site names, subtitles, and descriptions.
 */
export function SiteTranslationsSection({
  availableLanguages,
  unusedLanguages,
  translations,
  addLangCode,
  defaultName,
  defaultSubtitle,
  defaultDescription,
  onChangeAddLangCode,
  onAddTranslation,
  onRemoveTranslation,
  onUpdateTranslation,
}: SiteTranslationsSectionProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  return (
    <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-text">{t("additionalTranslations")}</h3>
          <p className="text-xs text-text-muted">{t("additionalTranslationsDesc")}</p>
        </div>

        {unusedLanguages.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Select
                value={addLangCode}
                onChange={onChangeAddLangCode}
                options={unusedLanguages.map((lang) => ({
                  value: lang.code,
                  label: `${lang.flag} ${lang.label}`,
                }))}
                placeholder={t("selectLanguagePlaceholder")}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={onAddTranslation}
              disabled={!addLangCode}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs shrink-0"
            >
              {tc("add")}
            </Button>
          </div>
        )}
      </div>

      {translations.length === 0 ? (
        <div className="py-4 text-center text-xs text-text-muted border border-dashed border-border rounded-lg bg-surface-hover/20">
          {t("noAdditionalTranslations")}
        </div>
      ) : (
        <div className="space-y-4">
          {translations.map((tr) => {
            const langInfo = availableLanguages.find((l) => l.code === tr.code);
            return (
              <div
                key={tr.code}
                className="p-4 bg-surface-hover/40 border border-border rounded-xl space-y-3 relative group animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                    <span className="text-base">{langInfo?.flag}</span>
                    {langInfo?.label || tr.code.toUpperCase()}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveTranslation(tr.code)}
                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    title={t("deleteTranslation")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    label={`${t("siteName")} (${tr.code.toUpperCase()})`}
                    value={tr.name}
                    onChange={(e) => onUpdateTranslation(tr.code, "name", e.target.value)}
                    placeholder={defaultName || t("translatedNamePlaceholder")}
                  />

                  <Input
                    label={`${t("siteSubtitle")} (${tr.code.toUpperCase()})`}
                    value={tr.subtitle}
                    onChange={(e) => onUpdateTranslation(tr.code, "subtitle", e.target.value)}
                    placeholder={defaultSubtitle || t("translatedSubtitlePlaceholder")}
                  />

                  <Textarea
                    label={`${t("siteDescription")} (${tr.code.toUpperCase()})`}
                    value={tr.description}
                    onChange={(e) => onUpdateTranslation(tr.code, "description", e.target.value)}
                    placeholder={defaultDescription || t("translatedDescPlaceholder")}
                    className="min-h-[70px] text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
