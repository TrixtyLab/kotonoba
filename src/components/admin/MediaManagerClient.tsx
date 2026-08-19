"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import {
  Upload, Image as ImageIcon, Trash2, Copy, Search, RefreshCw,
  HardDrive, Cloud, ExternalLink, Eye, Folder, FolderPlus,
  ChevronRight, ArrowLeft, FolderInput, Home
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
  /** Initial array of media files. */
  initialFiles?: MediaFileItem[];
  /** Underlying storage backend configuration details. */
  storageInfo?: {
    provider: "r2" | "s3" | "local";
    bucketName?: string;
    uploadDir?: string;
    publicUrl?: string;
  };
}

/**
 * Administrative media asset manager with file uploading, drag-and-drop ingestion, folder navigation, item relocation, and bulk deletion.
 *
 * @param props - MediaManagerClientProps configuring initial storage metadata and asset lists.
 * @returns React JSX media manager workspace.
 */
export function MediaManagerClient({
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
  
  // Modals & Actions
  const [previewFile, setPreviewFile] = useState<MediaFileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; isFolder: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveTargetFile, setMoveTargetFile] = useState<MediaFileItem | null>(null);
  const [targetDestinationFolder, setTargetDestinationFolder] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchMedia(currentFolder);
  }, [currentFolder]);

  async function fetchMedia(folder = currentFolder) {
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
  }

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

  function copyToClipboard(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada al portapapeles");
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

        <div className="flex items-center gap-2.5">
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
                  Privado
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
                  Privado
                </span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-text">{t("localFolder")}</span>
              </>
            )}
          </div>

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

      {/* Folders & Files Grid */}
      <div className="space-y-4">
        {/* Folders Section */}
        {filteredFolders.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              {t("foldersCount", { count: filteredFolders.length })}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredFolders.map((f) => (
                <div
                  key={f.path}
                  className="group relative p-3 rounded-xl border border-border bg-surface hover:border-accent hover:shadow-xs transition-all flex items-center justify-between"
                >
                  <button
                    type="button"
                    onClick={() => setCurrentFolder(f.path)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <Folder className="w-5 h-5 text-accent shrink-0 group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-semibold text-text truncate">{f.name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ path: f.path, name: f.name, isFolder: true })}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-opacity ml-1 shrink-0"
                    title={t("deleteFolder")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              {t("filesCount", { count: filteredFiles.length })}
            </h2>
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filterFiles")}
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-border bg-surface-hover/30 text-text focus:outline-hidden focus:border-accent"
              />
            </div>
          </div>

          {isLoading && files.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted">
              {t("loadingMedia")}
            </div>
          ) : filteredFiles.length === 0 && filteredFolders.length === 0 ? (
            <div className="p-12 text-center text-text-muted space-y-1.5 border border-border rounded-xl bg-surface">
              <ImageIcon className="w-8 h-8 opacity-30 mx-auto" />
              <p className="text-xs font-semibold text-text">{t("emptyFolder")}</p>
              <p className="text-[11px]">{t("emptyFolderDesc")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredFiles.map((file) => (
                <div
                  key={file.path}
                  className="group relative rounded-xl border border-border overflow-hidden bg-surface hover:border-accent hover:shadow-md transition-all flex flex-col"
                >
                  <div className="relative aspect-square bg-surface-hover/40 overflow-hidden flex items-center justify-center">
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />

                    {/* Quick actions overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-xs transition-colors"
                        title={t("preview")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoveTargetFile(file);
                          setTargetDestinationFolder(currentFolder);
                        }}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-xs transition-colors"
                        title={t("moveFile")}
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(file.url)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-xs transition-colors"
                        title={t("copyUrl")}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ path: file.path, name: file.filename, isFolder: false })}
                        className="p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white backdrop-blur-xs transition-colors"
                        title={tc("delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-0.5 text-left border-t border-border">
                    <p className="text-xs font-semibold text-text truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        title={t("newFolder")}
      >
        <div className="space-y-3 text-xs">
          <Input
            label={t("folderName")}
            placeholder={t("folderNamePlaceholder")}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            helperText={`/${currentFolder || t("root")}`}
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setNewFolderModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateFolder}>
              {t("createFolder")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Move File Modal */}
      {moveTargetFile && (
        <Modal
          isOpen={Boolean(moveTargetFile)}
          onClose={() => setMoveTargetFile(null)}
          title={`${t("moveFile")}: "${moveTargetFile.filename}"`}
        >
          <div className="space-y-3 text-xs">
            <Input
              label={t("destinationFolder")}
              placeholder="covers / articles"
              value={targetDestinationFolder}
              onChange={(e) => setTargetDestinationFolder(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setMoveTargetFile(null)}>
                {tc("cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleMoveFile} loading={isMoving}>
                {t("moveFile")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-surface border border-border rounded-xl p-5 shadow-xl space-y-3 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-bold text-text truncate max-w-[80%]">
                {previewFile.filename}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[50vh] overflow-hidden rounded-lg bg-black/40 flex items-center justify-center p-2">
              <img
                src={previewFile.url}
                alt={previewFile.filename}
                className="max-h-[45vh] object-contain rounded"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
              <span className="font-mono text-text-muted truncate max-w-xs text-[11px]">
                {previewFile.url}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(previewFile.url)}
                  icon={<Copy className="w-3.5 h-3.5" />}
                >
                  {t("copyUrl")}
                </Button>
                <a
                  href={previewFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-hover text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {tc("view")}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.isFolder ? t("deleteFolder") : t("deleteFile")}
        message={deleteTarget?.isFolder ? t("confirmDeleteFolder") : t("confirmDeleteFile")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
