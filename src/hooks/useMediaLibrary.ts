"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { formatBytes, resolveAbsoluteUrl } from "@/lib/utils/media";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";
import type { MediaFileItem, MediaFolderItem } from "@/components/admin/MediaManagerClient";
import type { MediaStorageSummary } from "@/components/admin/MediaToolbar";

interface UseMediaLibraryOptions {
  siteDomain?: string | null;
  storageInfo?: MediaStorageSummary;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

/**
 * State and network mutation hook orchestrating media browsing, uploads, folder creation, moves, deletions, and orphan cleanup.
 */
export function useMediaLibrary({ siteDomain, storageInfo, fileInputRef }: UseMediaLibraryOptions) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const toast = useToast();

  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [parentFolder, setParentFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [files, setFiles] = useState<MediaFileItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentStorage, setCurrentStorage] = useState<MediaStorageSummary | undefined>(storageInfo);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  const fetchMedia = useCallback(
    async (folder = currentFolder, cursor?: string | null) => {
      if (cursor) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const params = new URLSearchParams({ folder });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/media?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          if (cursor) {
            const incoming = (data.files || []) as MediaFileItem[];
            setFiles((prev) => {
              const seen = new Set(prev.map((item) => item.path));
              return [...prev, ...incoming.filter((item) => !seen.has(item.path))];
            });
          } else {
            setFolders(data.folders || []);
            setFiles(data.files || []);
          }
          setParentFolder(data.parentFolder);
          setNextCursor(data.nextCursor ?? null);
          setCurrentStorage(data.storage);
        } else {
          toast.error(data.error || t("loadingMedia"));
        }
      } catch {
        toast.error(t("loadingMedia"));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [currentFolder, t, toast]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/media?folder=${encodeURIComponent(currentFolder)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.success) {
          setFolders(data.folders || []);
          setFiles(data.files || []);
          setParentFolder(data.parentFolder);
          setNextCursor(data.nextCursor ?? null);
          setCurrentStorage(data.storage);
        } else {
          toast.error(data.error || t("loadingMedia"));
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
      if (currentFolder) formData.append("folder", currentFolder);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) uploadedCount++;
        else toast.error(`${file.name}: ${data.error}`);
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
        body: JSON.stringify({ path: deleteTarget.path, isFolder: deleteTarget.isFolder }),
      });
      const data = await res.json();
      if (data.success) {
        if (deleteTarget.isFolder) {
          setFolders((prev) => prev.filter((f) => f.path !== deleteTarget.path));
        } else {
          setFiles((prev) => prev.filter((f) => f.path !== deleteTarget.path));
        }
        if (previewFile?.path === deleteTarget.path) setPreviewFile(null);
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
          toast.success(t("cleanupOrphansSuccess", { count: data.deletedCount, bytes: formatBytes(data.freedBytes || 0) }));
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

  const filteredFiles = files.filter((f) => f.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return {
    currentFolder, setCurrentFolder, parentFolder, folders, files, nextCursor, currentStorage,
    isLoading, isLoadingMore, isUploading, searchQuery, setSearchQuery,
    previewFile, setPreviewFile, deleteTarget, setDeleteTarget, isDeleting,
    isDragOver, setIsDragOver, newFolderModalOpen, setNewFolderModalOpen,
    newFolderName, setNewFolderName, moveTargetFile, setMoveTargetFile,
    targetDestinationFolder, setTargetDestinationFolder, isMoving, isCleaningOrphans,
    filteredFiles, filteredFolders,
    fetchMedia, handleUploadFiles, handleCreateFolder, handleMoveFile,
    confirmDelete, getFullMediaUrl, copyToClipboard, handleCleanupOrphans,
  };
}
