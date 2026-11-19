"use client";

import React from "react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Image as ImageIcon,
  Link2,
  Upload,
  Loader2,
  PlaySquare,
} from "lucide-react";

/** Props for {@link EditorToolbar}. */
export interface EditorToolbarProps {
  editor: Editor | null;
  inlineFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingInline: boolean;
  onDirectInlineUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenMediaPicker: () => void;
  onOpenLinkModal: () => void;
  onOpenEmbedModal: () => void;
}

/** Sticky TipTap formatting and media insertion toolbar. */
export function EditorToolbar({
  editor,
  inlineFileInputRef,
  isUploadingInline,
  onDirectInlineUpload,
  onOpenMediaPicker,
  onOpenLinkModal,
  onOpenEmbedModal,
}: EditorToolbarProps) {
  const t = useTranslations("editor");

  function toggleMark(mark: "bold" | "italic" | "strike" | "code") {
    if (!editor) return;
    if (editor.isActive(mark)) editor.chain().focus().unsetMark(mark).run();
    else editor.chain().focus().setMark(mark).run();
  }

  function toggleHeading(level: 1 | 2 | 3) {
    if (!editor) return;
    if (editor.isActive("heading", { level })) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level }).run();
  }

  function toggleBlockquote() {
    if (!editor) return;
    if (editor.isActive("blockquote")) editor.chain().focus().lift("blockquote").run();
    else editor.chain().focus().wrapIn("blockquote").run();
  }

  function toggleBullet() {
    if (!editor) return;
    if (editor.isActive("bulletList")) editor.chain().focus().liftListItem("listItem").run();
    else editor.chain().focus().toggleBulletList().run();
  }

  function toggleOrdered() {
    if (!editor) return;
    if (editor.isActive("orderedList")) editor.chain().focus().liftListItem("listItem").run();
    else editor.chain().focus().toggleOrderedList().run();
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-1.5 sm:p-2 flex items-center gap-1 shadow-xs sticky top-16 sm:top-20 z-20 overflow-x-auto no-scrollbar">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggleMark("bold")}
        className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors shrink-0 ${editor?.isActive("bold") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
        title={t("boldTooltip")}
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggleMark("italic")}
        className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors shrink-0 ${editor?.isActive("italic") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
        title={t("italicTooltip")}
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggleMark("strike")}
        className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors shrink-0 ${editor?.isActive("strike") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
        title={t("strikeTooltip")}
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => toggleMark("code")}
        className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors shrink-0 ${editor?.isActive("code") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
        title={t("codeTooltip")}
      >
        <Code className="w-4 h-4" />
      </button>

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      {([1, 2, 3] as const).map((level) => {
        const Icon = level === 1 ? Heading1 : level === 2 ? Heading2 : Heading3;
        return (
          <button
            key={level}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleHeading(level)}
            className={`p-1.5 rounded-lg hover:bg-surface-hover shrink-0 ${editor?.isActive("heading", { level }) ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
            title={t(`h${level}`)}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleBullet}
        className={`p-1.5 rounded-lg hover:bg-surface-hover shrink-0 ${editor?.isActive("bulletList") ? "text-accent bg-accent/10" : "text-text"}`}
        title={t("bulletList")}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleOrdered}
        className={`p-1.5 rounded-lg hover:bg-surface-hover shrink-0 ${editor?.isActive("orderedList") ? "text-accent bg-accent/10" : "text-text"}`}
        title={t("orderedList")}
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleBlockquote}
        className={`p-1.5 rounded-lg hover:bg-surface-hover shrink-0 ${editor?.isActive("blockquote") ? "text-accent bg-accent/10" : "text-text"}`}
        title={t("quote")}
      >
        <Quote className="w-4 h-4" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        className="p-1.5 rounded-lg hover:bg-surface-hover text-text shrink-0"
        title={t("divider")}
      >
        <Minus className="w-4 h-4" />
      </button>

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenLinkModal}
        className={`p-1.5 rounded-lg hover:bg-surface-hover shrink-0 ${editor?.isActive("link") ? "text-accent bg-accent/10" : "text-text"}`}
        title={t("link")}
      >
        <Link2 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenMediaPicker}
        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text ml-1 shrink-0 whitespace-nowrap"
        title={t("library")}
      >
        <ImageIcon className="w-3.5 h-3.5 text-accent" />
        <span>{t("library")}</span>
      </button>

      <input
        ref={inlineFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onDirectInlineUpload}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inlineFileInputRef.current?.click()}
        disabled={isUploadingInline}
        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text shrink-0 whitespace-nowrap"
        title={t("directUpload")}
      >
        {isUploadingInline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-accent" />}
        <span>{t("directUpload")}</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenEmbedModal}
        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text shrink-0 whitespace-nowrap"
        title={t("embed")}
      >
        <PlaySquare className="w-3.5 h-3.5 text-accent" />
        <span>{t("embed")}</span>
      </button>

      <div className="ml-auto flex items-center gap-1 shrink-0 pl-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-20 text-text shrink-0"
          title={t("undo")}
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-20 text-text shrink-0"
          title={t("redo")}
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
