"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";

/** Props for {@link PostCoverImageField}. */
export interface PostCoverImageFieldProps {
  coverImage: string;
  onChangeCoverImage: (url: string) => void;
  coverFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingCover: boolean;
  onDirectCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLibrary: () => void;
}

/** Inspector card for managing cover image uploads, media library picks, and URLs. */
export function PostCoverImageField({
  coverImage,
  onChangeCoverImage,
  coverFileInputRef,
  isUploadingCover,
  onDirectCoverUpload,
  onOpenLibrary,
}: PostCoverImageFieldProps) {
  const t = useTranslations("editor");

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border space-y-3 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text">{t("coverImage")}</h3>
        {coverImage && (
          <button
            type="button"
            onClick={() => onChangeCoverImage("")}
            className="text-[11px] text-danger hover:underline font-semibold flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {t("remove")}
          </button>
        )}
      </div>

      {coverImage ? (
        <div className="relative rounded-xl overflow-hidden border border-border aspect-video w-full bg-surface-hover/30">
          <img src={coverImage} alt={t("coverImage")} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-hover/20 aspect-video w-full flex items-center justify-center text-text-muted text-xs">
          {t("noCoverAssigned")}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onDirectCoverUpload}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => coverFileInputRef.current?.click()}
          disabled={isUploadingCover}
          icon={isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          className="text-xs flex-1"
        >
          {isUploadingCover ? t("uploading") : t("upload")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenLibrary}
          icon={<ImageIcon className="w-3.5 h-3.5 text-accent" />}
          className="text-xs flex-1"
        >
          {t("library")}
        </Button>
      </div>

      <Input
        placeholder="https://... cover.jpg"
        value={coverImage || ""}
        onChange={(e) => onChangeCoverImage(e.target.value)}
      />
    </div>
  );
}
