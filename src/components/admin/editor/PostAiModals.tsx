"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { FileText, Globe, Sparkles } from "lucide-react";
import { normalizeLocale, type Locale } from "@/i18n/routing";

/** Props for {@link PostAiModals}. */
export interface PostAiModalsProps {
  hasExistingId: boolean;
  availableLanguageOptions: Array<{ value: Locale; label: string }>;
  aiModalOpen: boolean;
  setAiModalOpen: (open: boolean) => void;
  aiInstruction: string;
  setAiInstruction: (val: string) => void;
  aiLoading: boolean;
  onAiAssist: () => void;
  aiTranslateModalOpen: boolean;
  setAiTranslateModalOpen: (open: boolean) => void;
  targetTranslateLocale: Locale;
  setTargetTranslateLocale: (loc: Locale) => void;
  isTranslating: boolean;
  onAiTranslatePost: () => void;
  onManualTranslatePost: (actionType: "duplicate" | "change") => void;
}

/** AI editorial assistant rewrite modal + AI/manual translation modal. */
export function PostAiModals({
  hasExistingId,
  availableLanguageOptions,
  aiModalOpen,
  setAiModalOpen,
  aiInstruction,
  setAiInstruction,
  aiLoading,
  onAiAssist,
  aiTranslateModalOpen,
  setAiTranslateModalOpen,
  targetTranslateLocale,
  setTargetTranslateLocale,
  isTranslating,
  onAiTranslatePost,
  onManualTranslatePost,
}: PostAiModalsProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");

  return (
    <>
      <Modal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} title={t("aiAssistantModal")}>
        <div className="space-y-4">
          <p className="text-xs text-text-muted">{t("aiAssistantDesc")}</p>
          <Textarea
            label={t("aiInstruction")}
            placeholder={t("aiInstructionPlaceholder")}
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            className="min-h-[90px]"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setAiModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={onAiAssist}
              loading={aiLoading}
              icon={<Sparkles className="w-4 h-4" />}
              className="text-xs"
            >
              {t("applyChanges")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={aiTranslateModalOpen} onClose={() => setAiTranslateModalOpen(false)} title={t("translateModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">{t("translateModalDesc")}</p>

          <Select
            label={t("targetLanguage")}
            value={targetTranslateLocale}
            onChange={(val) => setTargetTranslateLocale(normalizeLocale(val))}
            options={availableLanguageOptions}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 bg-accent/5 border border-accent/20 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-accent flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4" /> {t("translateWithAi")}
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed">{t("translateWithAiDesc")}</p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={onAiTranslatePost}
                loading={isTranslating}
                icon={<Sparkles className="w-3.5 h-3.5" />}
                className="w-full text-xs font-semibold"
                disabled={isTranslating}
              >
                {isTranslating ? t("translating") : t("startTranslation")}
              </Button>
            </div>

            <div className="p-3.5 bg-surface-hover/50 border border-border rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-text flex items-center gap-1.5 text-xs">
                  <Globe className="w-4 h-4 text-emerald-400" /> {t("manualTranslate")}
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed">{t("manualTranslateDesc")}</p>
              </div>

              <div className="space-y-1.5">
                {hasExistingId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onManualTranslatePost("duplicate")}
                    loading={isTranslating}
                    icon={<FileText className="w-3.5 h-3.5" />}
                    className="w-full text-xs font-medium"
                    disabled={isTranslating}
                  >
                    {t("createDuplicateManual")}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onManualTranslatePost("change")}
                  disabled={isTranslating}
                  className="w-full text-xs text-text-muted hover:text-text"
                >
                  {t("changeLanguageOnly")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setAiTranslateModalOpen(false)} className="text-xs" disabled={isTranslating}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
