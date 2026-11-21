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

function ToolbarBtn({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors shrink-0 disabled:opacity-20 ${
        active ? "text-accent bg-accent/10 font-bold" : "text-text"
      }`}
      title={title}
    >
      {children}
    </button>
  );
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

  const markControls = [
    { key: "bold" as const, icon: Bold, title: t("boldTooltip") },
    { key: "italic" as const, icon: Italic, title: t("italicTooltip") },
    { key: "strike" as const, icon: Strikethrough, title: t("strikeTooltip") },
    { key: "code" as const, icon: Code, title: t("codeTooltip") },
  ];

  const headingIcons = { 1: Heading1, 2: Heading2, 3: Heading3 } as const;
  const isActive = (name: string, attrs?: Record<string, unknown>) => Boolean(editor?.isActive(name, attrs));

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

  function toggleListOrQuote(kind: "bulletList" | "orderedList" | "blockquote") {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (kind === "blockquote") {
      if (editor.isActive("blockquote")) chain.lift("blockquote").run();
      else chain.wrapIn("blockquote").run();
      return;
    }
    if (editor.isActive(kind)) chain.liftListItem("listItem").run();
    else if (kind === "bulletList") chain.toggleBulletList().run();
    else chain.toggleOrderedList().run();
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-1.5 sm:p-2 flex items-center gap-1 shadow-xs sticky top-16 sm:top-20 z-20 overflow-x-auto no-scrollbar">
      {markControls.map(({ key, icon: Icon, title }) => (
        <ToolbarBtn key={key} active={isActive(key)} onClick={() => toggleMark(key)} title={title}>
          <Icon className="w-4 h-4" />
        </ToolbarBtn>
      ))}

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      {([1, 2, 3] as const).map((level) => {
        const Icon = headingIcons[level];
        return (
          <ToolbarBtn key={level} active={isActive("heading", { level })} onClick={() => toggleHeading(level)} title={t(`h${level}`)}>
            <Icon className="w-4 h-4" />
          </ToolbarBtn>
        );
      })}

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      <ToolbarBtn active={isActive("bulletList")} onClick={() => toggleListOrQuote("bulletList")} title={t("bulletList")}>
        <List className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn active={isActive("orderedList")} onClick={() => toggleListOrQuote("orderedList")} title={t("orderedList")}>
        <ListOrdered className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn active={isActive("blockquote")} onClick={() => toggleListOrQuote("blockquote")} title={t("quote")}>
        <Quote className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title={t("divider")}>
        <Minus className="w-4 h-4" />
      </ToolbarBtn>

      <span className="w-px h-4 bg-border mx-1 shrink-0" />

      <ToolbarBtn active={isActive("link")} onClick={onOpenLinkModal} title={t("link")}>
        <Link2 className="w-4 h-4" />
      </ToolbarBtn>

      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onOpenMediaPicker} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text ml-1 shrink-0 whitespace-nowrap" title={t("library")}>
        <ImageIcon className="w-3.5 h-3.5 text-accent" />
        <span>{t("library")}</span>
      </button>

      <input ref={inlineFileInputRef} type="file" accept="image/*" className="hidden" onChange={onDirectInlineUpload} />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => inlineFileInputRef.current?.click()} disabled={isUploadingInline} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text shrink-0 whitespace-nowrap" title={t("directUpload")}>
        {isUploadingInline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-accent" />}
        <span>{t("directUpload")}</span>
      </button>

      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onOpenEmbedModal} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text shrink-0 whitespace-nowrap" title={t("embed")}>
        <PlaySquare className="w-3.5 h-3.5 text-accent" />
        <span>{t("embed")}</span>
      </button>

      <div className="ml-auto flex items-center gap-1 shrink-0 pl-2">
        <ToolbarBtn disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} title={t("undo")}>
          <Undo className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} title={t("redo")}>
          <Redo className="w-4 h-4" />
        </ToolbarBtn>
      </div>
    </div>
  );
}
