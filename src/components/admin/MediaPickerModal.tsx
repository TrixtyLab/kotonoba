"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MediaPickerGrid } from "@/components/admin/MediaPickerGrid";
import { useTranslations } from "next-intl";
import {
  X, Upload, Image as ImageIcon,
  HardDrive, Cloud, Search,
  ChevronRight, Home, FolderPlus
} from "lucide-react";

/** Metadata representation of a selectable media item. */
export interface MediaItem {
  filename: string;
  path: string;
  url: string;
  size: number;
  updatedAt: string | Date;
  folder: string;
}

/** Representation of a folder directory within the media picker dialog. */
export interface MediaFolderItem {
  name: string;
  path: string;
}

/** Configuration properties for the MediaPickerModal component. */
export interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, filename?: string) => void;
  title?: string;
}

/**
 * Modal dialog enabling authors to browse storage folders, upload new images, and select asset URLs.
 */
export function MediaPickerModal({ isOpen, onClose, onSelect, title }: MediaPickerModalProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const toast = useToast();
  const modalTitle = title || t("selectImage");
  const [currentFolder, setCurrentFolder] = useState<string>("");
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

  const fetchMedia = useCallback(
    async (folder = currentFolder) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/media?folder=${encodeURIComponent(folder)}`);
        const data = await res.json();
        if (data.success) {
          setFolders(data.folders || []);
          setMediaList(data.files || []);
          setStorageInfo(data.storage);
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
    if (!isOpen) return;
    const controller = new AbortController();
    fetch(`/api/media?folder=${encodeURIComponent(currentFolder)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data.success) {
          setFolders(data.folders || []);
          setMediaList(data.files || []);
          setStorageInfo(data.storage);
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
  }, [isOpen, currentFolder, t, toast]);

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", files[0]);
    if (currentFolder) formData.append("folder", currentFolder);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
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

  const breadcrumbs = currentFolder ? currentFolder.split("/") : [];
  const filteredMedia = mediaList.filter((m) => m.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70  animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
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
                    <span>Cloudflare R2 {storageInfo.bucketName ? `(${storageInfo.bucketName})` : ""}</span>
                  </>
                ) : storageInfo?.provider === "s3" ? (
                  <>
                    <Cloud className="w-3 h-3 text-indigo-500" />
                    <span>AWS S3 {storageInfo.bucketName ? `(${storageInfo.bucketName})` : ""}</span>
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

          <button type="button" onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-5 py-2.5 border-b border-border bg-surface-hover/30">
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

            <Button variant="outline" size="sm" onClick={() => setIsCreatingFolder(!isCreatingFolder)} icon={<FolderPlus className="w-3.5 h-3.5" />} className="text-xs">
              {t("folder")}
            </Button>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />

            <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} icon={<Upload className="w-3.5 h-3.5" />} className="text-xs">
              {isUploading ? t("uploading") : t("upload")}
            </Button>
          </div>
        </div>

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

        <MediaPickerGrid
          filteredFolders={filteredFolders}
          filteredMedia={filteredMedia}
          isLoading={isLoading}
          mediaCount={mediaList.length}
          selectedUrl={selectedUrl}
          onSelectFolder={setCurrentFolder}
          onSelectUrl={setSelectedUrl}
        />

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-hover/20">
          <div className="text-[11px] text-text-muted truncate max-w-[50%] font-mono">{selectedUrl || ""}</div>
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
