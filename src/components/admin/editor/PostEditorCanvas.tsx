"use client";

import React from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { EditorToolbar } from "@/components/admin/editor/EditorToolbar";

interface PostEditorCanvasProps {
  title: string;
  onTitleChange: (title: string) => void;
  showInspector: boolean;
  editor: Editor | null;
  inlineFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingInline: boolean;
  onDirectInlineUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenMediaPicker: () => void;
  onOpenLinkModal: () => void;
  onOpenEmbedModal: () => void;
}

/**
 * Primary article authoring surface containing the headline field, TipTap formatting toolbar,
 * and rich-text document canvas.
 */
export function PostEditorCanvas({
  title,
  onTitleChange,
  showInspector,
  editor,
  inlineFileInputRef,
  isUploadingInline,
  onDirectInlineUpload,
  onOpenMediaPicker,
  onOpenLinkModal,
  onOpenEmbedModal,
}: PostEditorCanvasProps) {
  const t = useTranslations("editor");

  return (
    <div className={`${showInspector ? "lg:col-span-8" : "lg:col-span-12"} space-y-4 min-w-0`}>
      <div className="p-4 sm:p-6 bg-surface border border-border rounded-xl shadow-xs space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("postTitlePlaceholder")}
          className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-0 text-text placeholder-text-muted/30 focus:outline-hidden focus:ring-0 leading-tight"
        />
      </div>

      <EditorToolbar
        editor={editor}
        inlineFileInputRef={inlineFileInputRef}
        isUploadingInline={isUploadingInline}
        onDirectInlineUpload={onDirectInlineUpload}
        onOpenMediaPicker={onOpenMediaPicker}
        onOpenLinkModal={onOpenLinkModal}
        onOpenEmbedModal={onOpenEmbedModal}
      />

      <div className="bg-surface border border-border rounded-xl p-3.5 sm:p-6 lg:p-8 min-h-[350px] sm:min-h-[500px] shadow-xs">
        <EditorContent editor={editor} className="prose-blog focus:outline-hidden" />
      </div>
    </div>
  );
}
