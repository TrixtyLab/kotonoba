"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "next-intl";
import { Upload, Trash2, HardDrive, Cloud, FolderPlus } from "lucide-react";

export interface MediaStorageSummary {
  provider: "r2" | "s3" | "local";
  bucketName?: string;
  uploadDir?: string;
  publicUrl?: string;
  usedBytes?: number;
  quotaBytes?: number;
}

interface MediaToolbarProps {
  currentStorage?: MediaStorageSummary;
  isCleaningOrphans: boolean;
  isUploading: boolean;
  onCleanupOrphans: () => void;
  onOpenNewFolderModal: () => void;
  onTriggerUpload: () => void;
  formatBytes: (bytes: number) => string;
}

/**
 * Header toolbar for the media asset workspace displaying active backend quota status
 * and primary upload/folder/orphan-cleanup triggers.
 */
export function MediaToolbar({
  currentStorage,
  isCleaningOrphans,
  isUploading,
  onCleanupOrphans,
  onOpenNewFolderModal,
  onTriggerUpload,
  formatBytes,
}: MediaToolbarProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">{t("title")}</h1>
        <p className="text-xs text-text-muted mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="px-3 py-1.5 rounded-lg bg-surface border border-border flex items-center gap-2 text-xs font-semibold shadow-2xs">
          {currentStorage?.provider === "r2" ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-accent" />
              <span className="text-text font-bold">Cloudflare R2</span>
              {currentStorage.bucketName && (
                <span className="text-[11px] font-mono text-text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                  {currentStorage.bucketName}
                </span>
              )}
              <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium">
                {tc("private")}
              </span>
            </>
          ) : currentStorage?.provider === "s3" ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-text font-bold">AWS S3</span>
              {currentStorage.bucketName && (
                <span className="text-[11px] font-mono text-text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                  {currentStorage.bucketName}
                </span>
              )}
              <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded font-medium">
                {tc("private")}
              </span>
            </>
          ) : (
            <>
              <HardDrive className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-text">{t("localFolder")}</span>
            </>
          )}
          {typeof currentStorage?.usedBytes === "number" && (currentStorage?.quotaBytes ?? 0) > 0 && (
            <span className="text-[11px] font-mono text-text-muted bg-surface-hover px-1.5 py-0.5 rounded">
              {t("storageQuota", {
                used: formatBytes(currentStorage.usedBytes),
                quota: formatBytes(currentStorage.quotaBytes!),
              })}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onCleanupOrphans}
          loading={isCleaningOrphans}
          icon={<Trash2 className="w-3.5 h-3.5 text-text-muted" />}
        >
          {t("cleanupOrphans")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenNewFolderModal}
          icon={<FolderPlus className="w-3.5 h-3.5 text-accent" />}
        >
          {t("newFolder")}
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onTriggerUpload}
          disabled={isUploading}
          icon={<Upload className="w-3.5 h-3.5" />}
        >
          {isUploading ? t("uploading") : t("uploadImage")}
        </Button>
      </div>
    </div>
  );
}
