"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { parseEmbedUrl, extractItchId, extractSteamId } from "@/lib/utils/embeds";

interface UseEditorMediaAndEmbedsOptions {
  editor: Editor | null;
  onAssignCoverImage: (url: string) => void;
}

/**
 * Encapsulates direct uploads, media library picker targeting, link insertion, and embed dialogs
 * for the rich-text editor workspace.
 */
export function useEditorMediaAndEmbeds({
  editor,
  onAssignCoverImage,
}: UseEditorMediaAndEmbedsOptions) {
  const t = useTranslations("editor");
  const toast = useToast();

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"editor" | "cover">("editor");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  function handleInsertEmbed() {
    const raw = embedUrl.trim();
    if (!raw) return;

    const itchId = extractItchId(raw);
    const steamId = extractSteamId(raw);

    if (itchId) {
      editor?.chain().focus().insertContent(`<p>@[itch](${itchId})</p>`).run();
      toast.success(t("itchInserted"));
    } else if (steamId) {
      editor?.chain().focus().insertContent(`<p>@[steam](${steamId})</p>`).run();
      toast.success(t("steamInserted"));
    } else {
      const embed = parseEmbedUrl(raw);
      if (embed) {
        editor?.chain().focus().insertContent(`<p>@[${embed.type}](${raw})</p>`).run();
        toast.success(t("embedInserted"));
      } else {
        editor
          ?.chain()
          .focus()
          .insertContent(`<p><a href="${raw}" target="_blank" rel="noopener noreferrer">${raw}</a></p>`)
          .run();
        toast.info(t("linkInserted"));
      }
    }

    setEmbedUrl("");
    setEmbedModalOpen(false);
  }

  function openLinkModal() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrl(previousUrl);
    setLinkModalOpen(true);
  }

  function handleSaveLink() {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkModalOpen(false);
    setLinkUrl("");
  }

  function handleRemoveLink() {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkModalOpen(false);
    setLinkUrl("");
  }

  function openMediaPicker(target: "editor" | "cover") {
    setMediaTarget(target);
    setMediaPickerOpen(true);
  }

  function handleMediaSelect(url: string) {
    if (mediaTarget === "cover") {
      onAssignCoverImage(url);
      toast.success(t("coverAssigned"));
    } else {
      editor?.chain().focus().setImage({ src: url }).run();
      toast.success(t("imageInserted"));
    }
  }

  async function uploadAsset(file: File, folder: "covers" | "articles"): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.url) {
      return data.url as string;
    }
    throw new Error(data.error || "");
  }

  async function handleDirectCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const url = await uploadAsset(file, "covers");
      if (url) {
        onAssignCoverImage(url);
        toast.success(t("coverUploaded"));
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("coverUploadError"));
    } finally {
      setIsUploadingCover(false);
      e.target.value = "";
    }
  }

  async function handleDirectInlineUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingInline(true);
    try {
      const url = await uploadAsset(file, "articles");
      if (url) {
        editor?.chain().focus().setImage({ src: url }).run();
        toast.success(t("inlineUploaded"));
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("inlineUploadError"));
    } finally {
      setIsUploadingInline(false);
      e.target.value = "";
    }
  }

  return {
    mediaPickerOpen,
    setMediaPickerOpen,
    mediaTarget,
    isUploadingCover,
    isUploadingInline,
    coverFileInputRef,
    inlineFileInputRef,
    embedModalOpen,
    setEmbedModalOpen,
    embedUrl,
    setEmbedUrl,
    linkModalOpen,
    setLinkModalOpen,
    linkUrl,
    setLinkUrl,
    handleInsertEmbed,
    openLinkModal,
    handleSaveLink,
    handleRemoveLink,
    openMediaPicker,
    handleMediaSelect,
    handleDirectCoverUpload,
    handleDirectInlineUpload,
  };
}
