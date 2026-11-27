"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { formatBytes } from "@/lib/utils/media";
import { Folder, Image as ImageIcon, Loader2, Check } from "lucide-react";
import type { MediaFolderItem, MediaItem } from "@/components/admin/MediaPickerModal";

export interface MediaPickerGridProps {
  filteredFolders: MediaFolderItem[];
  filteredMedia: MediaItem[];
  isLoading: boolean;
  mediaCount: number;
  selectedUrl: string | null;
  onSelectFolder: (folderPath: string) => void;
  onSelectUrl: (url: string) => void;
}

/**
 * Scrollable folder and image thumbnail picker grid rendered inside {@link MediaPickerModal}.
 */
export function MediaPickerGrid({
  filteredFolders,
  filteredMedia,
  isLoading,
  mediaCount,
  selectedUrl,
  onSelectFolder,
  onSelectUrl,
}: MediaPickerGridProps): React.JSX.Element {
  const t = useTranslations("media");

  return (
    <div className="flex-1 overflow-y-auto p-5 min-h-[280px] space-y-4">
      {filteredFolders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t("folders")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {filteredFolders.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => onSelectFolder(f.path)}
                className="p-2.5 rounded-lg border border-border bg-surface-hover/30 hover:border-accent flex items-center gap-2 text-left transition-colors"
              >
                <Folder className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs font-semibold text-text truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {filteredFolders.length > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{t("files")}</p>
        )}

        {isLoading && mediaCount === 0 ? (
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
                  onClick={() => onSelectUrl(m.url)}
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
  );
}
