"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { MediaDialogs } from "@/components/admin/MediaDialogs";
import { MediaLibraryGrid } from "@/components/admin/MediaLibraryGrid";
import {
  MediaToolbar,
  type MediaStorageSummary,
} from "@/components/admin/MediaToolbar";
import { MediaBreadcrumbBar } from "@/components/admin/MediaBreadcrumbBar";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { formatBytes } from "@/lib/utils/media";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

/** Metadata representation of a file stored in media assets storage. */
export interface MediaFileItem {
  filename: string;
  path: string;
  url: string;
  size: number;
  updatedAt: string | Date;
  folder: string;
}

/** Representation of a storage directory folder item. */
export interface MediaFolderItem {
  name: string;
  path: string;
}

/** Configuration properties for the MediaManagerClient interface. */
export interface MediaManagerClientProps {
  siteDomain?: string | undefined;
  initialFiles?: MediaFileItem[];
  storageInfo?: MediaStorageSummary;
}

/**
 * Administrative media asset manager with file uploading, cursor pagination, drag-and-drop ingestion,
 * folder navigation, item relocation, and bulk deletion.
 */
export function MediaManagerClient({
  siteDomain,
  storageInfo,
}: MediaManagerClientProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const media = useMediaLibrary({ siteDomain, storageInfo, fileInputRef });

  return (
    <div className="space-y-6">
      <MediaToolbar
        currentStorage={media.currentStorage}
        isCleaningOrphans={media.isCleaningOrphans}
        isUploading={media.isUploading}
        onCleanupOrphans={media.handleCleanupOrphans}
        onOpenNewFolderModal={() => media.setNewFolderModalOpen(true)}
        onTriggerUpload={() => fileInputRef.current?.click()}
        formatBytes={formatBytes}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => media.handleUploadFiles(e.target.files)}
      />

      <MediaBreadcrumbBar
        currentFolder={media.currentFolder}
        parentFolder={media.parentFolder}
        isLoading={media.isLoading}
        onSelectFolder={media.setCurrentFolder}
        onRefresh={() => void media.fetchMedia(media.currentFolder)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          media.setIsDragOver(true);
        }}
        onDragLeave={() => media.setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          media.setIsDragOver(false);
          media.handleUploadFiles(e.dataTransfer.files);
        }}
        className={`p-6 border-2 border-dashed rounded-xl text-center transition-all cursor-pointer ${
          media.isDragOver
            ? "border-accent bg-accent/5 text-accent"
            : "border-border hover:border-accent/40 bg-surface-hover/30 text-text-muted"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-1">
          <Upload className="w-5 h-5 text-accent mb-1" />
          <p className="text-xs font-semibold text-text">
            {t("dragDropPrompt")}{" "}
            <span className="font-mono text-accent">
              /{media.currentFolder || t("root")}
            </span>
          </p>
          <p className="text-[11px] text-text-muted">{t("allowedFormats")}</p>
        </div>
      </div>

      <MediaLibraryGrid
        siteDomain={siteDomain}
        currentFolder={media.currentFolder}
        filteredFolders={media.filteredFolders}
        filteredFiles={media.filteredFiles}
        isLoading={media.isLoading}
        totalFilesCount={media.files.length}
        searchQuery={media.searchQuery}
        onSearchQueryChange={media.setSearchQuery}
        onOpenFolder={media.setCurrentFolder}
        onPreviewFile={media.setPreviewFile}
        onStartMoveFile={(file) => {
          media.setMoveTargetFile(file);
          media.setTargetDestinationFolder(media.currentFolder);
        }}
        onCopyUrl={media.copyToClipboard}
        onRequestDelete={media.setDeleteTarget}
        formatBytes={formatBytes}
      />

      {media.nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            loading={media.isLoadingMore}
            onClick={() =>
              void media.fetchMedia(media.currentFolder, media.nextCursor)
            }
          >
            {media.isLoadingMore ? tc("loadingMore") : tc("loadMore")}
          </Button>
        </div>
      )}

      <MediaDialogs
        siteDomain={siteDomain}
        currentFolder={media.currentFolder}
        newFolderModalOpen={media.newFolderModalOpen}
        onCloseNewFolderModal={() => media.setNewFolderModalOpen(false)}
        newFolderName={media.newFolderName}
        onChangeNewFolderName={media.setNewFolderName}
        onCreateFolder={media.handleCreateFolder}
        moveTargetFile={media.moveTargetFile}
        onCloseMoveModal={() => media.setMoveTargetFile(null)}
        targetDestinationFolder={media.targetDestinationFolder}
        onChangeTargetDestinationFolder={media.setTargetDestinationFolder}
        isMoving={media.isMoving}
        onMoveFile={media.handleMoveFile}
        previewFile={media.previewFile}
        previewDisplayUrl={
          media.previewFile
            ? media.getFullMediaUrl(media.previewFile.url)
            : undefined
        }
        onClosePreviewModal={() => media.setPreviewFile(null)}
        onCopyUrl={media.copyToClipboard}
        deleteTarget={media.deleteTarget}
        onCloseDeleteModal={() => media.setDeleteTarget(null)}
        isDeleting={media.isDeleting}
        onConfirmDelete={media.confirmDelete}
      />
    </div>
  );
}
