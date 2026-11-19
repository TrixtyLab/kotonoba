"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { MediaDialogs } from "@/components/admin/MediaDialogs";
import { MediaLibraryGrid } from "@/components/admin/MediaLibraryGrid";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";
import {
  Upload, Trash2, RefreshCw,
  HardDrive, Cloud, FolderPlus,
  ChevronRight, ArrowLeft, Home
} from "lucide-react";

/**
 * Metadata representation of a file stored in media assets storage.
 */
export interface MediaFileItem {
  /** Base filename. */
  filename: string;
  /** Storage path relative to uploads directory. */
  path: string;
  /** Public accessible HTTP URL. */
  url: string;
  /** File size in bytes. */
  size: number;
  /** Last modified timestamp. */
  updatedAt: string | Date;
  /** Parent folder path. */
  folder: string;
}

/**
 * Representation of a storage directory folder item.
 */
export interface MediaFolderItem {
  /** Directory display name. */
  name: string;
  /** Storage path. */
  path: string;
}

/**
 * Configuration properties for the MediaManagerClient interface.
 */
export interface MediaManagerClientProps {
  /** Domain configured for the active site used to format shareable full media URLs. */
  siteDomain?: string | null;
  /** Initial array of media files. */
  initialFiles?: MediaFileItem[];
  /** Underlying storage backend configuration details. */
  storageInfo?: {
    provider: "r2" | "s3" | "local";
    bucketName?: string;
    uploadDir?: string;
    publicUrl?: string;
    usedBytes?: number;
    quotaBytes?: number;
  };
}

/**
 * Administrative media asset manager with file uploading, drag-and-drop ingestion, folder navigation, item relocation, and bulk deletion.
 *
 * @param props - MediaManagerClientProps configuring initial storage metadata and asset lists.
 * @returns React JSX media manager workspace.
 */
export function MediaManagerClient({
  siteDomain,
  storageInfo,
}: MediaManagerClientProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const toast = useToast();
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [files, setFiles] = useState<MediaFileItem[]>([]);
  const [currentStorage, setCurrentStorage] = useState(storageInfo);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [previewFile, setPreviewFile] = useState<MediaFileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; isFolder: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveTargetFile, setMoveTargetFile] = useState<MediaFileItem | null>(null);
  const [targetDestinationFolder, setTargetDestinationFolder] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchMedia = useCallback(
    async (folder = currentFolder) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/media?folder=${encodeURIComponent(folder)}`);
        const data = await res.json();
        if (data.success) {
          setFolders(data.folders || []);
          setFiles(data.files || []);
          setParentFolder(data.parentFolder);
          setCurrentStorage(data.storage);
        }
      } catch {
        toast.error(t("loadingMedia"));
      } finally {
        setIsLoading(false);
      }
    },
    [currentFolder, t, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/media?folder=${encodeURIComponent(currentFolder)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success) {
          setFolders(data.folders || []);
          setFiles(data.files || []);
          setParentFolder(data.parentFolder);
          setCurrentStorage(data.storage);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== "AbortError") {
          toast.error(t("loadingMedia"));
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentFolder, t, toast]);

  async function handleUploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolder) {
        formData.append("folder", currentFolder);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          uploadedCount++;
        } else {
          toast.error(`${file.name}: ${data.error}`);
        }
      } catch {
        toast.error(t("uploadError"));
      }
    }

    if (uploadedCount > 0) {
      toast.success(t("uploadSuccess", { count: uploadedCount }));
      await fetchMedia(currentFolder);
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) {
      toast.error(t("folderNamePlaceholder"));
      return;
    }

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createFolder",
          folderName: newFolderName.trim(),
          parentFolder: currentFolder,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(t("folderCreated"));
        setNewFolderName("");
        setNewFolderModalOpen(false);
        await fetchMedia(currentFolder);
      } else {
        toast.error(data.error || t("uploadError"));
      }
    } catch {
      toast.error(t("uploadError"));
    }
  }

  async function handleMoveFile() {
    if (!moveTargetFile) return;
    setIsMoving(true);

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          itemPath: moveTargetFile.path,
          targetFolder: targetDestinationFolder,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(t("fileMoved"));
        setMoveTargetFile(null);
        await fetchMedia(currentFolder);
      } else {
        toast.error(data.error || t("uploadError"));
      }
    } catch {
      toast.error(t("uploadError"));
    } finally {
      setIsMoving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch("/api/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: deleteTarget.path,
          isFolder: deleteTarget.isFolder,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (deleteTarget.isFolder) {
          setFolders((prev) => prev.filter((f) => f.path !== deleteTarget.path));
        } else {
          setFiles((prev) => prev.filter((f) => f.path !== deleteTarget.path));
        }
        if (previewFile?.path === deleteTarget.path) {
          setPreviewFile(null);
        }
        toast.success(deleteTarget.isFolder ? t("folderDeleted") : t("fileDeleted"));
      } else {
        toast.error(data.error || tc("delete"));
      }
    } catch {
      toast.error(tc("delete"));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  function getFullMediaUrl(rawUrl: string): string {
    const baseUrl = siteDomain
      ? buildSiteBaseUrl(siteDomain)
      : typeof window !== "undefined"
      ? window.location.origin
      : "";
    if (!baseUrl) return rawUrl;
    return resolveAbsoluteUrl(rawUrl, baseUrl) || rawUrl;
  }

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(getFullMediaUrl(url));
    toast.success(t("urlCopied"));
  }

  async function handleCleanupOrphans() {
    setIsCleaningOrphans(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanupOrphans" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.deletedCount > 0) {
          toast.success(
            t("cleanupOrphansSuccess", {
              count: data.deletedCount,
              bytes: formatBytes(data.freedBytes || 0),
            })
          );
          fetchMedia(currentFolder);
        } else {
          toast.info(t("cleanupOrphansEmpty"));
        }
      } else {
        toast.error(data.error || t("cleanupOrphansError"));
      }
    } catch {
      toast.error(t("cleanupOrphansError"));
    } finally {
      setIsCleaningOrphans(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  const breadcrumbs = currentFolder ? currentFolder.split("/") : [];

  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{t("title")}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("subtitle")}
          </p>
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
            onClick={handleCleanupOrphans}
            loading={isCleaningOrphans}
            icon={<Trash2 className="w-3.5 h-3.5 text-text-muted" />}
          >
            {t("cleanupOrphans")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewFolderModalOpen(true)}
            icon={<FolderPlus className="w-3.5 h-3.5 text-accent" />}
          >
            {t("newFolder")}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            {isUploading ? t("uploading") : t("uploadImage")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Navigation Breadcrumb Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface shadow-xs">
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setCurrentFolder("")}
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
                  onClick={() => setCurrentFolder(folderPath)}
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
              onClick={() => setCurrentFolder(parentFolder)}
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {tc("back")}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchMedia(currentFolder)}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />}
          />
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleUploadFiles(e.dataTransfer.files);
        }}
        className={`p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${
          isDragOver
            ? "border-accent bg-accent/5 text-accent"
            : "border-border hover:border-accent/40 bg-surface-hover/30 text-text-muted"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-1">
          <Upload className="w-5 h-5 text-accent mb-1" />
          <p className="text-xs font-semibold text-text">
            {t("dragDropPrompt")} <span className="font-mono text-accent">/{currentFolder || t("root")}</span>
          </p>
          <p className="text-[11px] text-text-muted">
            {t("allowedFormats")}
          </p>
        </div>
      </div>

      <MediaLibraryGrid
        currentFolder={currentFolder}
        filteredFolders={filteredFolders}
        filteredFiles={filteredFiles}
        isLoading={isLoading}
        totalFilesCount={files.length}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenFolder={setCurrentFolder}
        onPreviewFile={setPreviewFile}
        onStartMoveFile={(file) => {
          setMoveTargetFile(file);
          setTargetDestinationFolder(currentFolder);
        }}
        onCopyUrl={copyToClipboard}
        onRequestDelete={setDeleteTarget}
        formatBytes={formatBytes}
      />

      <MediaDialogs
        currentFolder={currentFolder}
        newFolderModalOpen={newFolderModalOpen}
        onCloseNewFolderModal={() => setNewFolderModalOpen(false)}
        newFolderName={newFolderName}
        onChangeNewFolderName={setNewFolderName}
        onCreateFolder={handleCreateFolder}
        moveTargetFile={moveTargetFile}
        onCloseMoveModal={() => setMoveTargetFile(null)}
        targetDestinationFolder={targetDestinationFolder}
        onChangeTargetDestinationFolder={setTargetDestinationFolder}
        isMoving={isMoving}
        onMoveFile={handleMoveFile}
        previewFile={previewFile}
        previewDisplayUrl={previewFile ? getFullMediaUrl(previewFile.url) : undefined}
        onClosePreviewModal={() => setPreviewFile(null)}
        onCopyUrl={copyToClipboard}
        deleteTarget={deleteTarget}
        onCloseDeleteModal={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
