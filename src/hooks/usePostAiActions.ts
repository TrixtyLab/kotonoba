"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useRouter, type Locale } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { createPost } from "@/actions/posts";
import { createPage } from "@/actions/pages";
import { generateExcerptAction, rewriteAction, translateAction } from "@/actions/ai";
import { POST_STATUS } from "@/lib/config/constants";
import { generateSlug } from "@/lib/utils/slug";

interface UsePostAiActionsOptions {
  siteId: string;
  mode: "post" | "page";
  postId?: string;
  editor: Editor | null;
  title: string;
  slug: string;
  contentHtml: string;
  excerpt: string;
  coverImage: string;
  locale: Locale;
  availableLanguageOptions: Array<{ value: Locale; label: string }>;
  selectedCategories: string[];
  selectedTags: string[];
  onSetTitle: (title: string) => void;
  onSetSlug: (slug: string) => void;
  onSetExcerpt: (excerpt: string) => void;
  onSetContentHtml: (html: string) => void;
  onSetLocale: (locale: Locale) => void;
}

/**
 * Coordinates AI writing assistants (excerpt summary, rewrite, translation) and manual localized draft duplication.
 */
export function usePostAiActions({
  siteId,
  mode,
  postId,
  editor,
  title,
  slug,
  contentHtml,
  excerpt,
  coverImage,
  locale,
  availableLanguageOptions,
  selectedCategories,
  selectedTags,
  onSetTitle,
  onSetSlug,
  onSetExcerpt,
  onSetContentHtml,
  onSetLocale,
}: UsePostAiActionsOptions) {
  const t = useTranslations("editor");
  const router = useRouter();
  const toast = useToast();

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTranslateModalOpen, setAiTranslateModalOpen] = useState(false);
  const [targetTranslateLocale, setTargetTranslateLocale] = useState<Locale>(locale === "es" ? "en" : "es");
  const [isTranslating, setIsTranslating] = useState(false);

  function openAiTranslateModal() {
    const otherLocale =
      availableLanguageOptions.find((opt) => opt.value !== locale)?.value ||
      (locale === "es" ? "en" : "es");
    setTargetTranslateLocale(otherLocale);
    setAiTranslateModalOpen(true);
  }

  async function handleAiGenerateExcerpt() {
    const text = editor ? editor.getText() : "";
    if (!text && !title) {
      toast.error(t("aiExcerptEmpty"));
      return;
    }

    setAiLoading(true);
    try {
      const res = await generateExcerptAction(siteId, text, title);
      if (res.success) {
        onSetExcerpt(res.excerpt);
        toast.success(t("aiExcerptSuccess"));
      } else {
        toast.error(res.error || t("aiExcerptError"));
      }
    } catch {
      toast.error(t("aiConnectionError"));
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiAssist() {
    if (!aiInstruction.trim()) return;
    const currentText = editor ? editor.getHTML() : "";
    if (!currentText) {
      toast.error(t("aiNoContent"));
      return;
    }

    setAiLoading(true);
    try {
      const res = await rewriteAction(siteId, currentText, aiInstruction);
      if (res.success) {
        editor?.commands.setContent(res.result);
        onSetContentHtml(res.result);
        setAiModalOpen(false);
        setAiInstruction("");
        toast.success(t("aiRewriteSuccess"));
      } else {
        toast.error(res.error || t("aiRewriteError"));
      }
    } catch {
      toast.error(t("aiConnectionError"));
    } finally {
      setAiLoading(false);
    }
  }

  async function translateTitleAndExcerpt(): Promise<void> {
    if (title.trim()) {
      const resTitle = await translateAction(siteId, title, targetTranslateLocale);
      if (resTitle.success) {
        onSetTitle(resTitle.translated);
        onSetSlug(generateSlug(resTitle.translated));
      }
    }
    if (excerpt.trim()) {
      const resExcerpt = await translateAction(siteId, excerpt, targetTranslateLocale);
      if (resExcerpt.success) onSetExcerpt(resExcerpt.translated);
    }
  }

  async function translateEditorBody(): Promise<void> {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (!currentHtml || currentHtml === "<p></p>") return;
    const resContent = await translateAction(siteId, currentHtml, targetTranslateLocale);
    if (resContent.success) {
      editor.commands.setContent(resContent.translated);
      onSetContentHtml(resContent.translated);
    }
  }

  async function handleAiTranslatePost() {
    if (!title && (!editor || !editor.getHTML())) {
      toast.error(t("aiTranslateEmpty"));
      return;
    }

    setIsTranslating(true);
    try {
      await translateTitleAndExcerpt();
      await translateEditorBody();
      onSetLocale(targetTranslateLocale);
      setAiTranslateModalOpen(false);
      const targetLabel =
        availableLanguageOptions.find((l) => l.value === targetTranslateLocale)?.label || targetTranslateLocale;
      toast.success(
        t("aiTranslateSuccess", {
          type: mode === "page" ? t("pageType") : t("postType"),
          language: targetLabel,
        })
      );
    } catch {
      toast.error(t("aiTranslateError"));
    } finally {
      setIsTranslating(false);
    }
  }

  async function createDuplicatedTranslation(targetLabel: string): Promise<void> {
    const currentHtml = editor ? editor.getHTML() : contentHtml;
    const rawContent = currentHtml && currentHtml !== "<p></p>" ? currentHtml : "";
    const duplicatedTitle = `${title} (${targetTranslateLocale.toUpperCase()})`;
    const duplicatedSlug = slug ? `${slug}-${targetTranslateLocale}` : generateSlug(duplicatedTitle);

    const commonPayload = {
      title: duplicatedTitle,
      slug: duplicatedSlug,
      content: rawContent,
      contentMd: "",
      contentHtml: rawContent,
      contentFormat: "html" as const,
      excerpt,
      coverImage,
      status: POST_STATUS.DRAFT,
      locale: targetTranslateLocale,
    };

    const res =
      mode === "page"
        ? await createPage(siteId, commonPayload)
        : await createPost(siteId, {
            ...commonPayload,
            categoryIds: selectedCategories,
            tagIds: selectedTags,
          });

    if (!res.success) {
      toast.error(res.error || t("manualDraftError"));
      return;
    }

    setAiTranslateModalOpen(false);
    toast.success(t("manualDraftCreated", { language: targetLabel }));
    const createdId = "pageId" in res ? res.pageId : res.postId;
    router.push(mode === "page" ? `/admin/pages/${createdId}` : `/admin/posts/${createdId}`);
  }

  async function handleManualTranslatePost(actionType: "duplicate" | "change") {
    const targetLabel =
      availableLanguageOptions.find((l) => l.value === targetTranslateLocale)?.label || targetTranslateLocale;

    if (actionType === "change" || !postId) {
      onSetLocale(targetTranslateLocale);
      setAiTranslateModalOpen(false);
      toast.success(
        t("manualLanguageChanged", {
          type: mode === "page" ? t("pageType") : t("postType"),
          language: targetLabel,
        })
      );
      return;
    }

    setIsTranslating(true);
    try {
      await createDuplicatedTranslation(targetLabel);
    } catch {
      toast.error(t("manualDraftError"));
    } finally {
      setIsTranslating(false);
    }
  }

  return {
    aiModalOpen,
    setAiModalOpen,
    aiInstruction,
    setAiInstruction,
    aiLoading,
    aiTranslateModalOpen,
    setAiTranslateModalOpen,
    targetTranslateLocale,
    setTargetTranslateLocale,
    isTranslating,
    openAiTranslateModal,
    handleAiGenerateExcerpt,
    handleAiAssist,
    handleAiTranslatePost,
    handleManualTranslatePost,
  };
}
