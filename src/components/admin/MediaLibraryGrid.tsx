"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Eye,
  Folder,
  FolderInput,
  Image as ImageIcon,
  Search,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  MediaFileItem,
  MediaFolderItem,
} from "@/components/admin/MediaManagerClient";

/** Props for {@link MediaLibraryGrid}. */
export interface MediaLibraryGridProps {
  siteDomain: string | undefined;
  currentFolder: string;
  filteredFolders: MediaFolderItem[];
  filteredFiles: MediaFileItem[];
  isLoading: boolean;
  totalFilesCount: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenFolder: (folderPath: string) => void;
  onPreviewFile: (file: MediaFileItem) => void;
  onStartMoveFile: (file: MediaFileItem) => void;
  onCopyUrl: (url: string) => void;
  onRequestDelete: (target: {
    path: string;
    name: string;
    isFolder: boolean;
  }) => void;
  formatBytes: (bytes: number) => string;
}

/**
 * Renders the tenant media subfolder cards, filterable asset grid, and empty state placeholder.
 */
export function MediaLibraryGrid({
  siteDomain,
  filteredFolders,
  filteredFiles,
  isLoading,
  totalFilesCount,
  searchQuery,
  onSearchQueryChange,
  onOpenFolder,
  onPreviewFile,
  onStartMoveFile,
  onCopyUrl,
  onRequestDelete,
  formatBytes,
}: MediaLibraryGridProps) {
  const t = useTranslations("media");
  const tc = useTranslations("common");

  return (
    <div className="space-y-4">
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
                  onClick={() => onOpenFolder(f.path)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <Folder className="w-5 h-5 text-accent shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold text-text truncate">
                    {f.name}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onRequestDelete({
                      path: f.path,
                      name: f.name,
                      isFolder: true,
                    })
                  }
                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-danger/10 text-danger transition-opacity ml-1 shrink-0"
                  title={t("deleteFolder")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t("filterFiles")}
              className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-border bg-surface-hover/30 text-text focus:outline-hidden focus:border-accent"
            />
          </div>
        </div>

        {isLoading && totalFilesCount === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            {t("loadingMedia")}
          </div>
        ) : filteredFiles.length === 0 && filteredFolders.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="w-8 h-8 opacity-40" />}
            title={t("emptyFolder")}
            description={t("emptyFolderDesc")}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredFiles.map((file) => (
              <div
                key={file.path}
                className="group relative rounded-xl border border-border overflow-hidden bg-surface hover:border-accent hover:shadow-md transition-all flex flex-col"
              >
                <div className="relative aspect-square bg-surface-hover/40 overflow-hidden flex items-center justify-center">
                  <img
                    src={`//${siteDomain}${file.url}`}
                    alt={file.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />

                  <div className="absolute inset-0 bg-black/40 lg:bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 sm:gap-1.5 p-1.5 sm:p-2">
                    <button
                      type="button"
                      onClick={() => onPreviewFile(file)}
                      className="p-2 sm:p-1.5 rounded-lg bg-black/40 lg:bg-white/20 hover:bg-white text-white hover:text-black transition-colors min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                      title={t("preview")}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartMoveFile(file)}
                      className="p-2 sm:p-1.5 rounded-lg bg-black/40 lg:bg-white/20 hover:bg-white text-white hover:text-black transition-colors min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                      title={t("moveFile")}
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyUrl(file.url)}
                      className="p-2 sm:p-1.5 rounded-lg bg-black/40 lg:bg-white/20 hover:bg-white text-white hover:text-black transition-colors min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                      title={t("copyUrl")}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onRequestDelete({
                          path: file.path,
                          name: file.filename,
                          isFolder: false,
                        })
                      }
                      className="p-2 sm:p-1.5 rounded-lg bg-danger/80 hover:bg-danger text-white transition-colors min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                      title={tc("delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 space-y-0.5 text-left border-t border-border">
                  <p
                    className="text-xs font-semibold text-text truncate"
                    title={file.filename}
                  >
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
  );
}
