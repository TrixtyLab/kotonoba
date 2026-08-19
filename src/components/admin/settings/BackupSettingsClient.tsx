"use client";

import React, { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { Archive, Download, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the BackupSettingsClient component.
 */
export interface BackupSettingsClientProps {
  /** Target site ID. */
  siteId: string;
}

/**
 * Site data backup export and restoration management panel supporting downloadable ZIP snapshots and restoration merging.
 *
 * @param props - BackupSettingsClientProps configuring target site ID.
 * @returns React JSX backup settings view.
 */
export function BackupSettingsClient({ siteId }: BackupSettingsClientProps) {
  const t = useTranslations("settings");
  const toast = useToast();
  const router = useRouter();

  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExportBackup() {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/backup/export?siteId=${encodeURIComponent(siteId)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kotonoba-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success(t("saveSuccess"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("saveError");
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  }

  async function executeImport() {
    if (!importFile) {
      toast.error(t("noFileSelected"));
      return;
    }

    setIsImporting(true);
    const formData = new FormData();
    formData.append("backup", importFile);
    formData.append("siteId", siteId);
    formData.append("mode", importMode);

    try {
      const res = await fetch("/api/backup/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.stats) {
        toast.success(
          t("restoreSuccess", {
            posts: data.stats.posts,
            categories: data.stats.categories,
            tags: data.stats.tags,
            settings: data.stats.settings,
            media: data.stats.media,
          })
        );
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        toast.error(t("restoreError", { error: data.error || "Unknown error" }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error(t("restoreError", { error: msg }));
    } finally {
      setIsImporting(false);
      setShowReplaceConfirm(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Archive className="w-5 h-5 text-accent" />
          <span>{t("backup")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("backupDesc")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Export Backup Card */}
        <div className="p-5 bg-surface-hover/30 border border-border rounded-xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Download className="w-4 h-4 text-accent" />
              <span>{t("exportBackup")}</span>
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {t("exportBackupDesc")}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleExportBackup}
            loading={isExporting}
            icon={<Download className="w-4 h-4" />}
            className="w-full text-xs"
          >
            {isExporting ? t("downloadingBackup") : t("downloadBackupBtn")}
          </Button>
        </div>

        {/* Import Backup Card */}
        <div className="p-5 bg-surface-hover/30 border border-border rounded-xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" />
              <span>{t("importBackup")}</span>
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {t("importBackupDesc")}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelected}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 rounded-xl border border-dashed cursor-pointer text-center text-xs transition-all ${
              importFile
                ? "bg-accent/5 border-accent text-accent"
                : "border-border hover:border-text-muted bg-surface/50 text-text-muted"
            }`}
          >
            {importFile ? (
              <span className="font-semibold">{t("fileSelected", { name: importFile.name, size: `${(importFile.size / 1024).toFixed(1)} KB` })}</span>
            ) : (
              <span>{t("selectBackupFile")}</span>
            )}
          </div>

          {importFile && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text">{t("restoreMode")}</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                      className="accent-accent"
                    />
                    <span>{t("modeMerge")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="accent-accent"
                    />
                    <span className="text-rose-500 font-semibold">{t("modeReplace")}</span>
                  </label>
                </div>
              </div>

              <Button
                variant={importMode === "replace" ? "danger" : "primary"}
                onClick={() => {
                  if (importMode === "replace") {
                    setShowReplaceConfirm(true);
                  } else {
                    executeImport();
                  }
                }}
                loading={isImporting}
                icon={<Upload className="w-4 h-4" />}
                className="w-full text-xs"
              >
                {isImporting ? t("restoring") : t("startRestoreBtn")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showReplaceConfirm}
        onClose={() => setShowReplaceConfirm(false)}
        onConfirm={executeImport}
        title={t("dangerReplaceAll")}
        message={t("replaceWarning")}
        confirmText={t("confirmReplaceAll")}
        variant="danger"
      />
    </div>
  );
}
