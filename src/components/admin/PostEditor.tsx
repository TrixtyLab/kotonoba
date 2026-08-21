"use client";

import React, { useState, useTransition, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { createPost, updatePost } from "@/actions/posts";
import { createPage, updatePage } from "@/actions/pages";
import { createTag } from "@/actions/tags";
import { generateExcerptAction, rewriteAction, translateAction } from "@/actions/ai";
import { generateDubLinkAction } from "@/actions/dub";
import { useRouter } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Undo, Redo, Image as ImageIcon,
  Sparkles, Save, ArrowLeft, Clock, FileText, CheckCircle2,
  Folder, Tag, Link2, X, Eye, SlidersHorizontal, Upload, Loader2,
  PlaySquare, RefreshCw, Globe, Send, QrCode, Copy, Share2, ExternalLink
} from "lucide-react";
import { parseEmbedUrl, extractSteamId, extractItchId, extractYouTubeId, extractVimeoId } from "@/lib/utils/embeds";

/**
 * Configuration properties for the rich-text article editor.
 */
export interface PostEditorProps {
  /** Unique database identifier of the target blog site. */
  siteId: string;
  /** Operating mode: regular blog post or standalone custom static page. */
  mode?: "post" | "page";
  /** List of supported BCP 47 locale codes enabled for authoring. */
  supportedLocales?: string[];
  /** Flag indicating whether the Dub.co link shortening integration is enabled. */
  isDubEnabled?: boolean;
  /** Pre-existing article data when editing an existing post. */
  initialPost?: {
    id: string;
    title: string;
    slug: string;
    contentMd: string;
    excerpt: string;
    coverImage: string | null;
    status: "draft" | "published" | "archived";
    locale: string;
    pinned?: boolean;
    shortUrl?: string | null;
    categories?: string[];
    tags?: string[];
  };
  /** List of available categories for taxonomy assignment. */
  availableCategories?: Array<{ id: string; name: string }>;
  /** List of available tags for taxonomy assignment. */
  availableTags?: Array<{ id: string; name: string }>;
}

/** Predefined catalog of selectable authoring languages. */
export const ALL_LANGUAGE_OPTIONS = [
  { value: "es", label: "Español (es)" },
  { value: "en", label: "English (en)" },
  { value: "fr", label: "Français (fr)" },
  { value: "de", label: "Deutsch (de)" },
  { value: "pt", label: "Português (pt)" },
  { value: "it", label: "Italiano (it)" },
  { value: "ja", label: "日本語 (ja)" },
  { value: "zh", label: "简体中文 (zh)" },
];

/**
 * Custom TipTap extension resetting active marks and heading blocks upon pressing Enter.
 */
const AutoExitBlockOnEnter = Extension.create({
  name: "autoExitBlockOnEnter",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const parentType = $from.parent.type.name;

        if (parentType === "listItem" || parentType === "taskItem") {
          return false;
        }

        if (parentType === "heading") {
          const isAtEnd = $from.parentOffset === $from.parent.content.size;
          if (isAtEnd) {
            return editor.chain().splitBlock({ keepMarks: false }).setParagraph().unsetAllMarks().run();
          }
        }

        if (parentType === "blockquote" && $from.parent.content.size === 0) {
          return editor.chain().lift("blockquote").setParagraph().unsetAllMarks().run();
        }

        return editor.chain().splitBlock({ keepMarks: false }).unsetAllMarks().run();
      },
    };
  },
});

/**
 * Converts a text string into a clean, URL-safe alphanumeric slug.
 *
 * @param {string} text - Raw input string to convert.
 * @returns {string} Clean URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Full-featured WYSIWYG rich-text article editor with TipTap engine, AI assistants, Dub.co link provisioning, and responsive live preview.
 *
 * @param {PostEditorProps} props - Configuration properties including target site ID, authoring mode, taxonomy catalogs, and initial content state.
 * @returns {React.JSX.Element} React JSX article editor interface.
 */
export function PostEditor({
  siteId,
  mode = "post",
  supportedLocales,
  isDubEnabled,
  initialPost,
  availableCategories = [],
  availableTags = [],
}: PostEditorProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const ta = useTranslations("admin");
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const allowedLocales = useMemo(() => {
    const list = supportedLocales && supportedLocales.length > 0 ? supportedLocales : ["es", "en"];
    return Array.from(new Set([...list, "es", "en"]));
  }, [supportedLocales]);

  const availableLanguageOptions = useMemo(() => {
    return ALL_LANGUAGE_OPTIONS.filter((opt) => allowedLocales.includes(opt.value));
  }, [allowedLocales]);

  const [title, setTitle] = useState(initialPost?.title || "");
  const [slug, setSlug] = useState(initialPost?.slug || "");
  const [contentHtml, setContentHtml] = useState(initialPost?.contentMd || "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || "");
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(initialPost?.status || "draft");
  const [locale, setLocale] = useState(initialPost?.locale || allowedLocales[0] || "es");
  const [pinned, setPinned] = useState(initialPost?.pinned ?? false);
  const [shortUrl, setShortUrl] = useState(initialPost?.shortUrl || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPost?.categories || []);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialPost?.tags || []);
  const [localTags, setLocalTags] = useState<Array<{ id: string; name: string }>>(availableTags || []);
  const [newTagInput, setNewTagInput] = useState("");
  const [showInspector, setShowInspector] = useState(true);

  const [dubModalOpen, setDubModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(
    initialPost?.shortUrl ? `https://api.dub.co/qr?url=${encodeURIComponent(initialPost.shortUrl)}` : ""
  );
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [isGeneratingDub, setIsGeneratingDub] = useState(false);

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"editor" | "cover">("editor");

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [aiTranslateModalOpen, setAiTranslateModalOpen] = useState(false);
  const [targetTranslateLocale, setTargetTranslateLocale] = useState(locale === "es" ? "en" : "es");
  const [isTranslating, setIsTranslating] = useState(false);

  function openAiTranslateModal() {
    const otherLocale = availableLanguageOptions.find((opt) => opt.value !== locale)?.value || (locale === "es" ? "en" : "es");
    setTargetTranslateLocale(otherLocale);
    setAiTranslateModalOpen(true);
  }

  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const [, setEditorTick] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        code: {
          HTMLAttributes: {
            class: "font-mono bg-surface-hover text-accent px-1.5 py-0.5 rounded text-[13px] border border-border",
          },
        },
      }),
      AutoExitBlockOnEnter,
      ImageExtension.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "rounded-xl border border-border shadow-xs my-5 mx-auto max-w-full",
        },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-accent underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder: t("contentPlaceholder"),
      }),
    ],
    editorProps: {
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") || "";
        const html = event.clipboardData?.getData("text/html") || "";
        const raw = text.trim() || html.trim();

        if (/<iframe[^>]*src=["']https?:\/\/(?:store\.steampowered\.com\/widget|itch\.io\/embed)[^"']*["']/i.test(raw)) {
          const itchId = extractItchId(raw);
          const steamId = extractSteamId(raw);
          if (itchId) {
            editor?.commands.insertContent(`<p>@[itch](${itchId})</p>`);
            toast.success(t("itchInserted"));
            return true;
          }
          if (steamId) {
            editor?.commands.insertContent(`<p>@[steam](${steamId})</p>`);
            toast.success(t("steamInserted"));
            return true;
          }
        }
        return false;
      },
    },
    content: initialPost?.contentMd || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContentHtml(html);
      if (editor.isEmpty) {
        editor.commands.unsetAllMarks();
      }
      setEditorTick((t) => t + 1);
    },
    onSelectionUpdate: () => {
      setEditorTick((t) => t + 1);
    },
    onTransaction: () => {
      setEditorTick((t) => t + 1);
    },
  });

  function toggleMark(mark: "bold" | "italic" | "strike" | "code") {
    if (!editor) return;
    if (editor.isActive(mark)) {
      editor.chain().focus().unsetMark(mark).run();
    } else {
      editor.chain().focus().setMark(mark).run();
    }
  }

  function toggleHeading(level: 1 | 2 | 3) {
    if (!editor) return;
    if (editor.isActive("heading", { level })) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().setHeading({ level }).run();
    }
  }

  function toggleBlockquote() {
    if (!editor) return;
    if (editor.isActive("blockquote")) {
      editor.chain().focus().lift("blockquote").run();
    } else {
      editor.chain().focus().wrapIn("blockquote").run();
    }
  }

  function toggleBullet() {
    if (!editor) return;
    if (editor.isActive("bulletList")) {
      editor.chain().focus().liftListItem("listItem").run();
    } else {
      editor.chain().focus().toggleBulletList().run();
    }
  }

  function toggleOrdered() {
    if (!editor) return;
    if (editor.isActive("orderedList")) {
      editor.chain().focus().liftListItem("listItem").run();
    } else {
      editor.chain().focus().toggleOrderedList().run();
    }
  }

  const { wordCount, readingTime } = useMemo(() => {
    const textOnly = contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const words = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
    const time = Math.max(1, Math.ceil(words / 200));
    return { wordCount: words, readingTime: time };
  }, [contentHtml]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    setSlug(slugify(newTitle));
  }

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
        editor?.chain().focus().insertContent(`<p><a href="${raw}" target="_blank" rel="noopener noreferrer">${raw}</a></p>`).run();
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
      setCoverImage(url);
      toast.success(t("coverAssigned"));
    } else {
      editor?.chain().focus().setImage({ src: url }).run();
      toast.success(t("imageInserted"));
    }
  }

  async function handleDirectCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "covers");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setCoverImage(data.url);
        toast.success(t("coverUploaded"));
      } else {
        toast.error(data.error || t("coverUploadError"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsUploadingCover(false);
      e.target.value = "";
    }
  }

  async function handleDirectInlineUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingInline(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "articles");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        editor?.chain().focus().setImage({ src: data.url }).run();
        toast.success(t("inlineUploaded"));
      } else {
        toast.error(data.error || t("inlineUploadError"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsUploadingInline(false);
      e.target.value = "";
    }
  }

  async function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    const existing = localTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedTags.includes(existing.id)) {
        setSelectedTags([...selectedTags, existing.id]);
      }
      setNewTagInput("");
      return;
    }

    const tagSlug = slugify(trimmed);
    const res = await createTag(siteId, { name: trimmed, slug: tagSlug });
    if (res.success) {
      const newTagObj = { id: res.id, name: trimmed };
      setLocalTags((prev) => [...prev, newTagObj]);
      setSelectedTags((prev) => [...prev, res.id]);
      setNewTagInput("");
      toast.success(t("tagCreated", { tag: trimmed }));
    } else {
      toast.error(res.error || t("tagCreateError"));
    }
  }

  async function handleSave(forcedStatus?: "draft" | "published" | "archived") {
    const saveStatus = forcedStatus !== undefined ? forcedStatus : status;
    const rawContent = editor ? editor.getHTML() : contentHtml;

    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }

    const payload = {
      title,
      slug: slug || slugify(title),
      contentMd: rawContent,
      contentHtml: rawContent,
      excerpt,
      coverImage,
      status: saveStatus,
      locale,
      pinned,
      shortUrl: shortUrl || undefined,
      categoryIds: selectedCategories,
      tagIds: selectedTags,
    };

    startTransition(async () => {
      if (mode === "page") {
        const pagePayload = {
          title,
          slug: slug || slugify(title),
          contentMd: rawContent,
          contentHtml: rawContent,
          excerpt,
          coverImage,
          status: saveStatus,
          locale,
        };

        if (initialPost?.id) {
          const res = await updatePage(initialPost.id, pagePayload);
          if (res.success) {
            setStatus(saveStatus);
            toast.success(
              saveStatus === "published"
                ? t("pagePublishedUpdated")
                : saveStatus === "archived"
                ? t("pageArchived")
                : t("pageDraftSaved")
            );
            router.refresh();
          } else {
            toast.error(res.error || t("saveChangesError"));
          }
        } else {
          const res = await createPage(siteId, pagePayload);
          if (res.success) {
            setStatus(saveStatus);
            toast.success(saveStatus === "published" ? t("pagePublished") : t("pageDraftCreated"));
            router.push(`/admin/pages/${res.pageId}`);
          } else {
            toast.error(res.error || t("pageCreateError"));
          }
        }
        return;
      }

      if (initialPost?.id) {
        const res = await updatePost(initialPost.id, payload);
        if (res.success) {
          setStatus(saveStatus);
          toast.success(
            saveStatus === "published"
              ? t("postPublishedUpdated")
              : saveStatus === "archived"
              ? t("postArchived")
              : t("postDraftSaved")
          );
          router.refresh();
        } else {
          toast.error(res.error || t("saveChangesError"));
        }
      } else {
        const res = await createPost(siteId, payload);
        if (res.success) {
          setStatus(saveStatus);
          toast.success(saveStatus === "published" ? t("postPublished") : t("postDraftCreated"));
          router.push(`/admin/posts/${res.postId}`);
        } else {
          toast.error(res.error || t("postCreateError"));
        }
      }
    });
  }

  async function handleGenerateDubLink() {
    if (!slug && !title) {
      toast.error(t("dubTitleRequired"));
      return;
    }
    setIsGeneratingDub(true);
    try {
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const postSlug = slug || slugify(title);
      const fullUrl = `${currentOrigin}/entry/${postSlug}`;

      const res = await generateDubLinkAction({
        postId: initialPost?.id,
        originalUrl: fullUrl,
        customSlug: postSlug,
        utmSource: utmSource.trim() || undefined,
        utmMedium: utmMedium.trim() || undefined,
        utmCampaign: utmCampaign.trim() || undefined,
      });

      if (res.success && res.shortUrl) {
        setShortUrl(res.shortUrl);
        if (res.qrCodeUrl) setQrCodeUrl(res.qrCodeUrl);
        setDubModalOpen(false);
        toast.success(t("dubSuccess"));
      } else {
        toast.error(res.error || t("dubError"));
      }
    } catch {
      toast.error(t("dubNetworkError"));
    } finally {
      setIsGeneratingDub(false);
    }
  }

  async function handleAiGenerateExcerpt() {
    const text = editor ? editor.getText() : "";
    if (!text && !title) {
      toast.error(t("aiExcerptEmpty"));
      return;
    }

    setAiLoading(true);
    try {
      const res = await generateExcerptAction(siteId, text || title);
      if (res.success) {
        setExcerpt(res.excerpt);
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
        setContentHtml(res.result);
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

  async function handleAiTranslatePost() {
    if (!title && (!editor || !editor.getHTML())) {
      toast.error(t("aiTranslateEmpty"));
      return;
    }

    setIsTranslating(true);
    try {
      if (title.trim()) {
        const resTitle = await translateAction(siteId, title, targetTranslateLocale);
        if (resTitle.success) {
          setTitle(resTitle.translated);
          setSlug(slugify(resTitle.translated));
        }
      }

      if (excerpt.trim()) {
        const resExcerpt = await translateAction(siteId, excerpt, targetTranslateLocale);
        if (resExcerpt.success) {
          setExcerpt(resExcerpt.translated);
        }
      }

      if (editor) {
        const currentHtml = editor.getHTML();
        if (currentHtml && currentHtml !== "<p></p>") {
          const resContent = await translateAction(siteId, currentHtml, targetTranslateLocale);
          if (resContent.success) {
            editor.commands.setContent(resContent.translated);
            setContentHtml(resContent.translated);
          }
        }
      }

      setLocale(targetTranslateLocale);
      setAiTranslateModalOpen(false);
      const targetLabel = ALL_LANGUAGE_OPTIONS.find((l) => l.value === targetTranslateLocale)?.label || targetTranslateLocale;
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

  async function handleManualTranslatePost(actionType: "duplicate" | "change") {
    const targetLabel = ALL_LANGUAGE_OPTIONS.find((l) => l.value === targetTranslateLocale)?.label || targetTranslateLocale;

    if (actionType === "change" || !initialPost?.id) {
      setLocale(targetTranslateLocale);
      setAiTranslateModalOpen(false);
      toast.success(
        t("manualLanguageChanged", {
          type: mode === "page" ? t("pageType") : t("postType"),
          language: targetLabel,
        })
      );
      return;
    }

    const currentHtml = editor ? editor.getHTML() : contentHtml;
    const rawContent = currentHtml && currentHtml !== "<p></p>" ? currentHtml : "";
    const duplicatedTitle = `${title} (${targetTranslateLocale.toUpperCase()})`;
    const duplicatedSlug = slug ? `${slug}-${targetTranslateLocale}` : slugify(duplicatedTitle);

    setIsTranslating(true);
    try {
      if (mode === "page") {
        const res = await createPage(siteId, {
          title: duplicatedTitle,
          slug: duplicatedSlug,
          contentMd: rawContent,
          contentHtml: rawContent,
          excerpt,
          coverImage,
          status: "draft",
          locale: targetTranslateLocale,
        });

        if (res.success) {
          setAiTranslateModalOpen(false);
          toast.success(t("manualDraftCreated", { language: targetLabel }));
          router.push(`/admin/pages/${res.pageId}`);
        } else {
          toast.error(res.error || t("manualDraftError"));
        }
      } else {
        const res = await createPost(siteId, {
          title: duplicatedTitle,
          slug: duplicatedSlug,
          contentMd: rawContent,
          contentHtml: rawContent,
          excerpt,
          coverImage,
          status: "draft",
          locale: targetTranslateLocale,
          categoryIds: selectedCategories,
          tagIds: selectedTags,
        });

        if (res.success) {
          setAiTranslateModalOpen(false);
          toast.success(t("manualDraftCreated", { language: targetLabel }));
          router.push(`/admin/posts/${res.postId}`);
        } else {
          toast.error(res.error || t("manualDraftError"));
        }
      }
    } catch {
      toast.error(t("manualDraftError"));
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(mode === "page" ? "/admin/pages" : "/admin/posts")}
            className="text-text-muted hover:text-text"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {mode === "page" ? tc("pages") : ta("recentPosts").split(" ")[0]}
          </Button>

          <span className="w-px h-4 bg-border" />

          <Badge variant={status === "published" ? "success" : status === "archived" ? "outline" : "warning"}>
            {status === "published" ? t("published") : status === "archived" ? t("archived") : t("draft")}
          </Badge>

          <span className="text-[11px] text-text-muted hidden md:inline-flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3" />
            {t("wordCount", { count: wordCount, minutes: readingTime })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInspector(!showInspector)}
            className="text-xs"
            title={t("postSettings")}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
            {showInspector ? t("hideDetails") : t("details")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="text-accent text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {t("aiAssistant")}
          </Button>

          {status !== "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("draft")}
              loading={isPending}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              {t("saveDraft")}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(status === "draft" ? "published" : status)}
            loading={isPending}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            {status === "published" ? t("saveChanges") : status === "archived" ? t("saveArchived") : t("publish")}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Editor + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Main Canvas */}
        <div className={`${showInspector ? "lg:col-span-8" : "lg:col-span-12"} space-y-4`}>
          {/* Title Box */}
          <div className="p-6 bg-surface border border-border rounded-xl shadow-xs space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t("postTitlePlaceholder")}
              className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-0 text-text placeholder-text-muted/30 focus:outline-hidden focus:ring-0 leading-tight"
            />
          </div>

          {/* WYSIWYG Formatting Toolbar */}
          <div className="bg-surface border border-border rounded-xl p-2 flex flex-wrap items-center gap-1 shadow-xs sticky top-20 z-20">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark("bold")}
              className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${editor?.isActive("bold") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("boldTooltip")}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark("italic")}
              className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${editor?.isActive("italic") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("italicTooltip")}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark("strike")}
              className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${editor?.isActive("strike") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("strikeTooltip")}
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark("code")}
              className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${editor?.isActive("code") ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("codeTooltip")}
            >
              <Code className="w-4 h-4" />
            </button>

            <span className="w-px h-4 bg-border mx-1" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleHeading(1)}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("heading", { level: 1 }) ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("h1")}
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleHeading(2)}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("heading", { level: 2 }) ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("h2")}
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleHeading(3)}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("heading", { level: 3 }) ? "text-accent bg-accent/10 font-bold" : "text-text"}`}
              title={t("h3")}
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <span className="w-px h-4 bg-border mx-1" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleBullet}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("bulletList") ? "text-accent bg-accent/10" : "text-text"}`}
              title={t("bulletList")}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleOrdered}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("orderedList") ? "text-accent bg-accent/10" : "text-text"}`}
              title={t("orderedList")}
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleBlockquote}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("blockquote") ? "text-accent bg-accent/10" : "text-text"}`}
              title={t("quote")}
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text"
              title={t("divider")}
            >
              <Minus className="w-4 h-4" />
            </button>

            <span className="w-px h-4 bg-border mx-1" />

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openLinkModal}
              className={`p-1.5 rounded-lg hover:bg-surface-hover ${editor?.isActive("link") ? "text-accent bg-accent/10" : "text-text"}`}
              title={t("link")}
            >
              <Link2 className="w-4 h-4" />
            </button>

            {/* Media Library image insertion */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openMediaPicker("editor")}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text ml-1"
              title={t("library")}
            >
              <ImageIcon className="w-3.5 h-3.5 text-accent" />
              <span>{t("library")}</span>
            </button>

            {/* Direct Image upload */}
            <input
              ref={inlineFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleDirectInlineUpload}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => inlineFileInputRef.current?.click()}
              disabled={isUploadingInline}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text"
              title={t("directUpload")}
            >
              {isUploadingInline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-accent" />}
              <span>{t("directUpload")}</span>
            </button>

            {/* Embed Media (YouTube, Vimeo, Steam, itch.io) */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEmbedModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-hover hover:bg-accent/10 hover:text-accent border border-border transition-colors flex items-center gap-1.5 text-text"
              title={t("embed")}
            >
              <PlaySquare className="w-3.5 h-3.5 text-accent" />
              <span>{t("embed")}</span>
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-20 text-text"
                title={t("undo")}
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                className="p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-20 text-text"
                title={t("redo")}
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Editor Canvas */}
          <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 min-h-[500px] shadow-xs">
            <EditorContent editor={editor} className="prose-blog focus:outline-hidden" />
          </div>
        </div>

        {/* Right Inspector Sidebar */}
        {showInspector && (
          <div className="lg:col-span-4 space-y-4">
            {/* Slug & Language */}
            <div className="p-5 rounded-xl bg-surface border border-border space-y-3.5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border">
                {t("postParams")}
              </h3>

              <div className="space-y-1">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label={t("urlSlug")}
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder={t("postSlugPlaceholder")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSlug(slugify(title));
                      toast.success(t("slugRegenerated"));
                    }}
                    className="text-xs shrink-0"
                    title={t("regenerateSlug")}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">{t("language")}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={openAiTranslateModal}
                    className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1 hover:underline"
                  >
                    <Globe className="w-3 h-3" />
                    {t("translatePost")}
                  </Button>
                </div>

                <Select
                  value={locale}
                  onChange={(val) => setLocale(val)}
                  options={availableLanguageOptions}
                />

                <Select
                  label={t("publishStatus")}
                  value={status}
                  onChange={(val) => setStatus(val as "draft" | "published" | "archived")}
                  options={[
                    { value: "draft", label: t("draftHidden") },
                    { value: "published", label: t("publishedVisible") },
                    { value: "archived", label: t("archived") },
                  ]}
                />
              </div>

              {/* Categories & Taxonomy (Vertical List) */}
              {mode === "post" && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-accent" />
                      <span>{t("categories")}</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableCategories.map((c) => (
                      <Checkbox
                        key={c.id}
                        checked={selectedCategories.includes(c.id)}
                        onChange={(checked) => {
                          if (checked) {
                            setSelectedCategories([...selectedCategories, c.id]);
                          } else {
                            setSelectedCategories(selectedCategories.filter((id) => id !== c.id));
                          }
                        }}
                        label={c.name}
                        className="w-full"
                      />
                    ))}
                    {availableCategories.length === 0 && (
                      <p className="text-xs text-text-muted">{t("noCategoriesYet")}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {mode === "post" && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-accent" />
                      <span>{t("tags")}</span>
                    </span>
                  </div>

                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {selectedTags.map((tId) => {
                        const tagObj = localTags.find((t) => t.id === tId);
                        return (
                          <span
                            key={tId}
                            className="inline-flex items-center gap-1 text-[11px] bg-accent/10 text-accent font-medium px-2 py-0.5 rounded-full border border-accent/20"
                          >
                            #{tagObj?.name || tId}
                            <button
                              type="button"
                              onClick={() => setSelectedTags(selectedTags.filter((id) => id !== tId))}
                              className="hover:text-rose-500 ml-0.5 cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder={t("newTagPlaceholder")}
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button size="sm" variant="secondary" onClick={handleAddTag} className="text-xs shrink-0">
                      {tc("add")}
                    </Button>
                  </div>

                  {localTags.filter((t) => !selectedTags.includes(t.id)).length > 0 && (
                    <div className="pt-1.5 border-t border-border/50">
                      <p className="text-[11px] text-text-muted mb-1.5">{t("existingSuggestions")}</p>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {localTags
                          .filter((t) => !selectedTags.includes(t.id))
                          .map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTags([...selectedTags, t.id])}
                              className="text-[11px] bg-surface-hover hover:bg-accent/10 hover:text-accent px-2 py-0.5 rounded border border-border transition-colors text-text-muted cursor-pointer"
                            >
                              + {t.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resumen / Extracto SEO */}
              <div className="space-y-1.5 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">{t("seoExcerpt")}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAiGenerateExcerpt}
                    disabled={aiLoading}
                    className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {t("aiGenerate")}
                  </Button>
                </div>
                <Textarea
                  placeholder={t("excerptPlaceholder")}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="min-h-[75px] text-xs"
                />
              </div>

              {mode === "post" && (
                <div className="pt-1">
                  <Checkbox
                    checked={pinned}
                    onChange={(val) => setPinned(val)}
                    label={t("pinPost")}
                  />
                </div>
              )}

              {/* Dub.co Short Link & UTM Builder */}
              {mode === "post" && isDubEnabled && (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-accent" />
                      <span>{t("dubShortLink")}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDubModalOpen(true)}
                      className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {shortUrl ? "UTM Builder" : t("generateDubLink")}
                    </Button>
                  </div>

                  {shortUrl ? (
                    <div className="flex items-center gap-1.5 bg-surface-hover/50 p-1.5 rounded-lg border border-border">
                      <input
                        type="text"
                        readOnly
                        value={shortUrl}
                        className="bg-transparent text-xs font-mono text-text flex-1 outline-hidden select-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(shortUrl);
                          toast.success(t("dubCopied"));
                        }}
                        className="p-1 h-auto text-xs shrink-0"
                        title={tc("copy")}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {qrCodeUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQrModalOpen(true)}
                          className="p-1 h-auto text-xs shrink-0"
                          title="QR Code"
                        >
                          <QrCode className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted leading-tight">
                      {t("dubPromoDesc")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Cover Image */}
            <div className="p-5 rounded-xl bg-surface border border-border space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  {t("coverImage")}
                </h3>
                {coverImage && (
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="text-[11px] text-rose-500 hover:underline font-semibold flex items-center gap-1"
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
                  onChange={handleDirectCoverUpload}
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
                  onClick={() => openMediaPicker("cover")}
                  icon={<ImageIcon className="w-3.5 h-3.5 text-accent" />}
                  className="text-xs flex-1"
                >
                  {t("library")}
                </Button>
              </div>

              <Input
                placeholder="https://... cover.jpg"
                value={coverImage || ""}
                onChange={(e) => setCoverImage(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        title={mediaTarget === "cover" ? t("selectCoverModalTitle") : t("insertImageModalTitle")}
      />

      {/* AI Assistant Modal */}
      <Modal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} title={t("aiAssistantModal")}>
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            {t("aiAssistantDesc")}
          </p>
          <Textarea
            label={t("aiInstruction")}
            placeholder={t("aiInstructionPlaceholder")}
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            className="min-h-[90px]"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setAiModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleAiAssist}
              loading={aiLoading}
              icon={<Sparkles className="w-4 h-4" />}
              className="text-xs"
            >
              {t("applyChanges")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Translation & Localization Modal */}
      <Modal isOpen={aiTranslateModalOpen} onClose={() => setAiTranslateModalOpen(false)} title={t("translateModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">
            {t("translateModalDesc")}
          </p>

          <Select
            label={t("targetLanguage")}
            value={targetTranslateLocale}
            onChange={(val) => setTargetTranslateLocale(val)}
            options={availableLanguageOptions}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* AI Translation Card */}
            <div className="p-3.5 bg-accent/5 border border-accent/20 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-accent flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4" /> {t("translateWithAi")}
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t("translateWithAiDesc")}
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleAiTranslatePost}
                loading={isTranslating}
                icon={<Sparkles className="w-3.5 h-3.5" />}
                className="w-full text-xs font-semibold"
                disabled={isTranslating}
              >
                {isTranslating ? t("translating") : t("startTranslation")}
              </Button>
            </div>

            {/* Manual Translation (Without AI) Card */}
            <div className="p-3.5 bg-surface-hover/50 border border-border rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-text flex items-center gap-1.5 text-xs">
                  <Globe className="w-4 h-4 text-emerald-400" /> {t("manualTranslate")}
                </p>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t("manualTranslateDesc")}
                </p>
              </div>

              <div className="space-y-1.5">
                {initialPost?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManualTranslatePost("duplicate")}
                    loading={isTranslating}
                    icon={<FileText className="w-3.5 h-3.5" />}
                    className="w-full text-xs font-medium"
                    disabled={isTranslating}
                  >
                    {t("createDuplicateManual")}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleManualTranslatePost("change")}
                  disabled={isTranslating}
                  className="w-full text-xs text-text-muted hover:text-text"
                >
                  {t("changeLanguageOnly")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setAiTranslateModalOpen(false)} className="text-xs" disabled={isTranslating}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Embed Modal */}
      <Modal isOpen={embedModalOpen} onClose={() => setEmbedModalOpen(false)} title={t("embedModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">
            {t("embedModalDesc")}
          </p>

          <Input
            label={t("embedInputLabel")}
            placeholder="steam:1299800, itch:2548291, https://... o <iframe>"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            helperText="Para juegos escribe steam:1299800 o itch:2548291. También puedes pegar URLs directas o código iframe."
          />

          <div className="p-3 bg-surface-hover/30 border border-border rounded-lg space-y-1.5 text-text-muted">
            <p className="font-semibold text-text">{t("supportedFormats")}</p>
            <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
              <li><strong>Steam:</strong> steam:1299800 o store.steampowered.com/app/1299800/</li>
              <li><strong>itch.io:</strong> itch:2548291 o itch.io/embed/2548291</li>
              <li><strong>YouTube:</strong> https://www.youtube.com/watch?v=...</li>
              <li><strong>X / Twitter:</strong> https://x.com/...</li>
              <li><strong>Bluesky:</strong> https://bsky.app/...</li>
              <li><strong>Iframes:</strong> &lt;iframe src=&quot;...&quot;&gt;&lt;/iframe&gt;</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setEmbedModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleInsertEmbed}
              disabled={!embedUrl.trim()}
              icon={<PlaySquare className="w-4 h-4" />}
              className="text-xs"
            >
              {t("insertEmbed")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Link Modal */}
      <Modal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={t("linkModalTitle")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveLink();
          }}
          className="space-y-4 text-xs"
        >
          <Input
            label={t("linkUrlLabel")}
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            helperText={t("linkUrlHelper")}
            autoFocus
          />

          <div className="flex justify-between items-center pt-2 border-t border-border">
            {editor?.isActive("link") ? (
              <Button type="button" variant="danger" onClick={handleRemoveLink} className="text-xs">
                {t("removeLink")}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setLinkModalOpen(false)} className="text-xs">
                {tc("cancel")}
              </Button>
              <Button type="submit" variant="primary" className="text-xs">
                {t("saveLink")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Dub.co UTM Builder Modal */}
      <Modal isOpen={dubModalOpen} onClose={() => setDubModalOpen(false)} title={t("dubModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">
            {t("dubModalDesc")}
          </p>

          <div className="space-y-3">
            <Input
              label={t("utmSourceLabel")}
              placeholder={t("utmSourcePlaceholder")}
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
            />

            <Input
              label={t("utmMediumLabel")}
              placeholder={t("utmMediumPlaceholder")}
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
            />

            <Input
              label={t("utmCampaignLabel")}
              placeholder={t("utmCampaignPlaceholder")}
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
            />
          </div>

          <div className="p-3 bg-surface-hover/30 border border-border rounded-lg space-y-1 text-text-muted">
            <p className="font-semibold text-text flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-accent" />
              {t("originalDestination")}
            </p>
            <p className="font-mono text-[11px] truncate">
              {typeof window !== "undefined" ? window.location.origin : ""}/entry/{slug || slugify(title)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setDubModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateDubLink}
              loading={isGeneratingDub}
              icon={<Sparkles className="w-4 h-4" />}
              className="text-xs"
            >
              {t("generateWithDub")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dub.co QR Code Modal */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title={t("qrModalTitle")}>
        <div className="space-y-4 text-xs text-center">
          <p className="text-text-muted">
            {t("qrModalDesc")}
          </p>

          {qrCodeUrl && (
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-border inline-block">
                <img src={qrCodeUrl} alt={t("qrModalTitle")} className="w-48 h-48 object-contain" />
              </div>
            </div>
          )}

          {shortUrl && (
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-accent font-semibold">{shortUrl}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shortUrl);
                  toast.success(tc("copied"));
                }}
                className="text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> {tc("copy")}
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="primary" onClick={() => setQrModalOpen(false)} className="text-xs">
              {t("close")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
