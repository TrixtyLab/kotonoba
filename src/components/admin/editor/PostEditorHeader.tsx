"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/** Props for {@link PostEditorHeader}. */
export interface PostEditorHeaderProps {
  mode: "post" | "page";
  status: "draft" | "published" | "scheduled" | "archived";
  wordCount: number;
  readingTime: number;
  showInspector: boolean;
  isPending: boolean;
  onNavigateBack: () => void;
  onToggleInspector: () => void;
  onOpenAiModal: () => void;
  onSaveDraft: () => void;
  onSavePrimary: () => void;
}

/**
 * Sticky top action bar for {@link PostEditor} showing status badge, reading time,
 * inspector toggle, AI assistant trigger, and draft/publish controls.
 */
export function PostEditorHeader({
  mode,
  status,
  wordCount,
  readingTime,
  showInspector,
  isPending,
  onNavigateBack,
  onToggleInspector,
  onOpenAiModal,
  onSaveDraft,
  onSavePrimary,
}: PostEditorHeaderProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const ta = useTranslations("admin");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateBack}
          className="text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {mode === "page" ? tc("pages") : ta("recentPosts").split(" ")[0]}
        </Button>

        <span className="w-px h-4 bg-border" />

        <Badge variant={status === "published" ? "success" : status === "archived" ? "outline" : "warning"}>
          {status === "published" ? t("published") : status === "archived" ? t("archived") : t("draft")}
        </Badge>

        <span className="text-[11px] text-text-muted hidden md:inline-flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3" />
          {t("wordCount", { count: wordCount, minutes: readingTime })}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleInspector}
          className="text-xs"
          title={t("postSettings")}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
          {showInspector ? t("hideDetails") : t("details")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAiModal}
          className="text-accent text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          {t("aiAssistant")}
        </Button>

        {status !== "published" && status !== "scheduled" && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            loading={isPending}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            {t("saveDraft")}
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={onSavePrimary}
          loading={isPending}
          icon={
            status === "scheduled" ? (
              <CalendarClock className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )
          }
        >
          {status === "published"
            ? t("saveChanges")
            : status === "scheduled"
            ? t("schedulePublication")
            : status === "archived"
            ? t("saveArchived")
            : t("publish")}
        </Button>
      </div>
    </div>
  );
}
