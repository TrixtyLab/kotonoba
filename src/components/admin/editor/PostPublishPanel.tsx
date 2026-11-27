"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CalendarClock, Globe, RefreshCw, Sparkles } from "lucide-react";
import { normalizeLocale, type Locale } from "@/i18n/routing";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";
import { generateSlug } from "@/lib/utils/slug";
import { useToast } from "@/components/ui/Toast";

/** Props for {@link PostPublishPanel}. */
export interface PostPublishPanelProps {
  mode: "post" | "page";
  title: string;
  slug: string;
  onSlugChange: (val: string, manual: boolean) => void;
  locale: Locale;
  onLocaleChange: (loc: Locale) => void;
  availableLanguageOptions: Array<{ value: Locale; label: string }>;
  onOpenTranslateModal: () => void;
  status: PostStatus;
  onStatusChange: (status: PostStatus) => void;
  scheduledAt: string;
  onScheduledAtChange: (val: string) => void;
  excerpt: string;
  onExcerptChange: (val: string) => void;
  aiLoading: boolean;
  onAiGenerateExcerpt: () => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  /** Hides the homepage pin control for roles that cannot change it. */
  canPin?: boolean;
}

/**
 * Inspector card managing URL slug, language/translation trigger, lifecycle status,
 * schedule date picker, SEO excerpt, and homepage pin option.
 */
export function PostPublishPanel({
  mode,
  title,
  slug,
  onSlugChange,
  locale,
  onLocaleChange,
  availableLanguageOptions,
  onOpenTranslateModal,
  status,
  onStatusChange,
  scheduledAt,
  onScheduledAtChange,
  excerpt,
  onExcerptChange,
  aiLoading,
  onAiGenerateExcerpt,
  pinned,
  onPinnedChange,
  canPin = true,
}: PostPublishPanelProps) {
  const t = useTranslations("editor");
  const toast = useToast();

  return (
    <>
      <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border">
        {t("postParams")}
      </h3>

      <div className="space-y-1">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label={t("urlSlug")}
              value={slug}
              onChange={(e) => {
                const val = e.target.value;
                onSlugChange(val, val.trim().length > 0);
              }}
              placeholder={t("postSlugPlaceholder")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onSlugChange(generateSlug(title), false);
              toast.success(t("slugRegenerated"));
            }}
            className="text-xs shrink-0"
            title={t("regenerateSlug")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text">{t("language")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenTranslateModal}
            className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1 hover:underline"
          >
            <Globe className="w-3 h-3" />
            {t("translatePost")}
          </Button>
        </div>

        <Select
          value={locale}
          onChange={(val) => onLocaleChange(normalizeLocale(val))}
          options={availableLanguageOptions}
        />

        <Select
          label={t("publishStatus")}
          value={status}
          onChange={(val) => onStatusChange(val as PostStatus)}
          options={[
            { value: POST_STATUS.DRAFT, label: t("draftHidden") },
            { value: POST_STATUS.PUBLISHED, label: t("publishedVisible") },
            { value: POST_STATUS.SCHEDULED, label: t("scheduledOption") },
            { value: POST_STATUS.ARCHIVED, label: t("archived") },
          ]}
        />

        {status === POST_STATUS.SCHEDULED && (
          <div className="space-y-1.5 p-3 rounded-lg bg-surface-hover/50 border border-border">
            <label className="text-xs font-semibold text-text flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-accent" />
              <span>{t("scheduleDate")}</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => onScheduledAtChange(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-hidden focus:ring-1 focus:ring-accent font-mono"
            />
            <p className="text-[11px] text-text-muted">{t("scheduleHint")}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text">{t("seoExcerpt")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAiGenerateExcerpt}
            disabled={aiLoading}
            className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {t("aiGenerate")}
          </Button>
        </div>
        <Textarea
          placeholder={t("excerptPlaceholder")}
          value={excerpt}
          onChange={(e) => onExcerptChange(e.target.value)}
          className="min-h-[75px] text-xs"
        />
      </div>

      {mode === "post" && canPin && (
        <div className="pt-1">
          <Checkbox checked={pinned} onChange={onPinnedChange} label={t("pinPost")} />
        </div>
      )}
    </>
  );
}
