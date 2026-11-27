"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { RefreshCw, ChevronRight, ArrowLeft, Home } from "lucide-react";

interface MediaBreadcrumbBarProps {
  currentFolder: string;
  parentFolder: string | null;
  isLoading: boolean;
  onSelectFolder: (folder: string) => void;
  onRefresh: () => void;
}

/**
 * Navigation breadcrumb trail and refresh toolbar for traversing hierarchical media folders.
 */
export function MediaBreadcrumbBar({
  currentFolder,
  parentFolder,
  isLoading,
  onSelectFolder,
  onRefresh,
}: MediaBreadcrumbBarProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const breadcrumbs = currentFolder ? currentFolder.split("/") : [];

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onSelectFolder("")}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
            !currentFolder
              ? "bg-accent/10 text-accent font-semibold"
              : "text-text-muted hover:text-text hover:bg-surface-hover"
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>{t("root")}</span>
        </button>

        {breadcrumbs.map((segment, idx) => {
          const folderPath = breadcrumbs.slice(0, idx + 1).join("/");
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <React.Fragment key={folderPath}>
              <ChevronRight className="w-3.5 h-3.5 text-text-muted/50 shrink-0" />
              <button
                type="button"
                onClick={() => onSelectFolder(folderPath)}
                className={`px-2 py-1 rounded-md transition-colors truncate max-w-[150px] ${
                  isLast
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                {segment}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {parentFolder !== null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectFolder(parentFolder)}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {tc("back")}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />}
        />
      </div>
    </div>
  );
}
