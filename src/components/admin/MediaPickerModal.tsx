"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import {
  X, Upload, Image as ImageIcon, Check, Loader2,
  RefreshCw, HardDrive, Cloud, Search, Folder,
  ChevronRight, ArrowLeft, Home, FolderPlus
} from "lucide-react";

/**
 * Metadata representation of a selectable media item.
 */
export interface MediaItem {
  /** Base filename. */
  filename: string;
  /** Storage path. */
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
 * Representation of a folder directory within the media picker dialog.
 */
export interface MediaFolderItem {
  /** Directory display name. */
  name: string;
  /** Storage path. */
  path: string;
}

/**
 * Configuration properties for the MediaPickerModal component.
 */
export interface MediaPickerModalProps {
  /** Visibility toggle. */
  isOpen: boolean;
  /** Callback fired when user requests modal dismissal. */
  onClose: () => void;
  /** Callback fired when user chooses a media asset. */
  onSelect: (url: string, filename?: string) => void;
  /** Header title of the picker modal. */
  title?: string;
}

/**
 * Modal dialog enabling authors to browse storage folders, upload new images, and select asset URLs for insertion into post content.
 *
 * @param props - MediaPickerModalProps configuring visibility and selection callback.
 * @returns React JSX media picker dialog element.
 */
export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  title,
}: MediaPickerModalProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const toast = useToast();
  const modalTitle = title || t("selectImage");
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    provider: "r2" | "s3" | "local";
    bucketName?: string;
    publicUrl?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMedia(currentFolder);
    }
  }, [isOpen, currentFolder]);

  async function fetchMedia(folder = currentFolder) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/media?folder=${encodeURIComponent(folder)}`);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setMediaList(data.files || []);
        setParentFolder(data.parentFolder);
        setStorageInfo(data.storage);
      }
    } catch {
      toast.error(t("loadingMedia"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
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
      if (data.success && data.url) {
        toast.success(t("uploadSuccess", { count: 1 }));
        setSelectedUrl(data.url);
        await fetchMedia(currentFolder);
      } else {
        toast.error(data.error || t("uploadError"));
      }
    } catch {
      toast.error(t("uploadError"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
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
        setIsCreatingFolder(false);
        await fetchMedia(currentFolder);
      } else {
        toast.error(data.error || t("uploadError"));
      }
    } catch {
      toast.error(t("uploadError"));
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

  const filteredMedia = mediaList.filter((m) =>
    m.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text">{modalTitle}</h3>
              <p className="text-[10px] text-text-muted flex items-center gap-1">
                {storageInfo?.provider === "r2" ? (
                  <>
                    <Cloud className="w-3 h-3 text-accent" />
                    <span>Cloudflare R2 {storageInfo.bucketName ? `(${storageInfo.bucketName})` : ''}</span>
                  </>
                ) : storageInfo?.provider === "s3" ? (
                  <>
                    <Cloud className="w-3 h-3 text-indigo-500" />
                    <span>AWS S3 {storageInfo.bucketName ? `(${storageInfo.bucketName})` : ''}</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3 h-3 text-text-muted" />
                    <span>{t("localFolder")}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-5 py-2.5 border-b border-border bg-surface-hover/30">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCurrentFolder("")}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                !currentFolder ? "bg-accent/10 text-accent font-semibold" : "text-text-muted hover:text-text"
              }`}
            >
              <Home className="w-3 h-3" />
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
                    className={`px-1.5 py-0.5 rounded text-[11px] truncate max-w-[120px] ${
                      isLast ? "bg-accent/10 text-accent font-semibold" : "text-text-muted hover:text-text"
                    }`}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-48">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filter")}
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-border bg-surface text-text focus:outline-hidden focus:border-accent"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              icon={<FolderPlus className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {t("folder")}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              icon={<Upload className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {isUploading ? t("uploading") : t("upload")}
            </Button>
          </div>
        </div>

        {/* Create folder mini input */}
        {isCreatingFolder && (
          <div className="px-5 py-2 border-b border-border bg-surface-hover/50 flex items-center gap-2">
            <input
              type="text"
              placeholder={t("folderNamePlaceholder")}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-text flex-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <Button size="sm" variant="primary" onClick={handleCreateFolder} className="text-xs py-1">
              {tc("create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)} className="text-xs py-1">
              {tc("cancel")}
            </Button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[280px] space-y-4">
          {/* Folders List */}
          {filteredFolders.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t("folders")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredFolders.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setCurrentFolder(f.path)}
                    className="p-2.5 rounded-lg border border-border bg-surface-hover/30 hover:border-accent flex items-center gap-2 text-left transition-colors"
                  >
                    <Folder className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-xs font-semibold text-text truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files Grid */}
          <div className="space-y-1.5">
            {filteredFolders.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t("files")}</p>
            )}

            {isLoading && mediaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-text-muted gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span className="text-xs">{t("loadingImages")}</span>
              </div>
            ) : filteredMedia.length === 0 && filteredFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-center text-text-muted space-y-1">
                <ImageIcon className="w-8 h-8 opacity-30 mx-auto" />
                <p className="text-xs font-semibold text-text">{t("emptyFolder")}</p>
                <p className="text-[11px]">{t("emptyFolderPickerDesc")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredMedia.map((m) => {
                  const isSelected = selectedUrl === m.url;
                  return (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => setSelectedUrl(m.url)}
                      className={`group relative rounded-xl border overflow-hidden text-left transition-all aspect-square flex flex-col justify-end p-2 ${
                        isSelected
                          ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-surface shadow-xs"
                          : "border-border hover:border-border-hover bg-surface-hover/20"
                      }`}
                    >
                      <img
                        src={m.url}
                        alt={m.filename}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      <div className="relative z-10 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        <p className="font-semibold truncate">{m.filename}</p>
                        <p className="text-white/80">{formatBytes(m.size)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-hover/20">
          <div className="text-[11px] text-text-muted truncate max-w-[50%] font-mono">
            {selectedUrl ? selectedUrl : ""}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedUrl}
              onClick={() => {
                if (selectedUrl) {
                  onSelect(selectedUrl);
                  onClose();
                }
              }}
            >
              {tc("confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
