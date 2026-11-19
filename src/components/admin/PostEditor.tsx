"use client";

import React, { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { createPost, updatePost } from "@/actions/posts";
import { createPage, updatePage } from "@/actions/pages";
import { createTag } from "@/actions/tags";
import { generateExcerptAction, rewriteAction, translateAction } from "@/actions/ai";
import { generateDubLinkAction } from "@/actions/dub";
import { useRouter, LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { EditorToolbar } from "@/components/admin/editor/EditorToolbar";
import { PostEditorHeader } from "@/components/admin/editor/PostEditorHeader";
import { PostPublishPanel } from "@/components/admin/editor/PostPublishPanel";
import { PostTaxonomyPanel } from "@/components/admin/editor/PostTaxonomyPanel";
import { PostCoverImageField } from "@/components/admin/editor/PostCoverImageField";
import { PostDubPanel } from "@/components/admin/editor/PostDubPanel";
import { PostAiModals } from "@/components/admin/editor/PostAiModals";
import { PostInsertModals } from "@/components/admin/editor/PostInsertModals";
import { AutoExitBlockOnEnter } from "@/components/admin/editor/tiptapExtensions";
import { parseEmbedUrl, extractSteamId, extractItchId } from "@/lib/utils/embeds";
import { generateSlug } from "@/lib/utils/slug";

/**
 * Configuration properties for the rich-text article editor.
 */
export interface PostEditorProps {
  /** Unique database identifier of the target blog site. */
  siteId: string;
  /** Operating mode: regular blog post or standalone custom static page. */
  mode?: "post" | "page";
  /** Optional array of supported locale codes configured for the active blog site. */
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
    status: "draft" | "published" | "scheduled" | "archived";
    publishedAt?: string | Date | null;
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

/** Predefined catalog of selectable authoring languages restricted to supported locales. */
const ALL_LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = LOCALES.map((code) => ({
  value: code,
  label: `${LOCALE_NAMES[code]} (${code})`,
}));

function buildEditorSnapshot(state: {
  title: string;
  slug: string;
  contentHtml: string;
  excerpt: string;
  coverImage: string;
}): string {
  return JSON.stringify(state);
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
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const allowedLocales = useMemo<Locale[]>(() => {
    const filtered = (supportedLocales || []).filter((code): code is Locale =>
      (LOCALES as readonly string[]).includes(code)
    );
    return Array.from(new Set([...LOCALES, ...filtered]));
  }, [supportedLocales]);

  const availableLanguageOptions = useMemo(() => {
    return ALL_LANGUAGE_OPTIONS.filter((opt) => allowedLocales.includes(opt.value));
  }, [allowedLocales]);

  const formatDateTimeLocal = (date?: Date | string | null): string => {
    if (!date) {
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState(initialPost?.title || "");
  const [slug, setSlug] = useState(initialPost?.slug || "");
  const [isSlugManual, setIsSlugManual] = useState(Boolean(initialPost?.id && initialPost?.slug));
  const [contentHtml, setContentHtml] = useState(initialPost?.contentMd || "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || "");
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || "");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled" | "archived">(initialPost?.status || "draft");
  const [scheduledAt, setScheduledAt] = useState<string>(
    initialPost?.publishedAt ? formatDateTimeLocal(initialPost.publishedAt) : formatDateTimeLocal()
  );
  const [locale, setLocale] = useState<Locale>(normalizeLocale(initialPost?.locale || allowedLocales[0]));
  const [pinned, setPinned] = useState(initialPost?.pinned ?? false);
  const [shortUrl, setShortUrl] = useState(initialPost?.shortUrl || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPost?.categories || []);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialPost?.tags || []);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    buildEditorSnapshot({
      title: initialPost?.title || "",
      slug: initialPost?.slug || "",
      contentHtml: initialPost?.contentMd || "",
      excerpt: initialPost?.excerpt || "",
      coverImage: initialPost?.coverImage || "",
    })
  );
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const isDirty = useMemo(() => {
    return (
      buildEditorSnapshot({
        title,
        slug,
        contentHtml,
        excerpt,
        coverImage,
      }) !== savedSnapshot
    );
  }, [title, slug, contentHtml, excerpt, coverImage, savedSnapshot]);

  const backHref = mode === "page" ? "/admin/pages" : "/admin/posts";

  function handleNavigateBack() {
    if (isDirty) {
      setLeaveConfirmOpen(true);
      return;
    }
    router.push(backHref);
  }

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
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
  const [targetTranslateLocale, setTargetTranslateLocale] = useState<Locale>(locale === "es" ? "en" : "es");
  const [isTranslating, setIsTranslating] = useState(false);

  function openAiTranslateModal() {
    const otherLocale =
      availableLanguageOptions.find((opt) => opt.value !== locale)?.value ||
      (locale === "es" ? "en" : "es");
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

  const { wordCount, readingTime } = useMemo(() => {
    const textOnly = contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const words = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
    const time = Math.max(1, Math.ceil(words / 200));
    return { wordCount: words, readingTime: time };
  }, [contentHtml]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (!isSlugManual) {
      setSlug(generateSlug(newTitle));
    }
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
        setCoverImage(url);
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

    const tagSlug = generateSlug(trimmed);
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

  async function handleSave(forcedStatus?: "draft" | "published" | "scheduled" | "archived") {
    const saveStatus = forcedStatus !== undefined ? forcedStatus : status;
    const rawContent = editor ? editor.getHTML() : contentHtml;

    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }

    let finalPublishedAt: Date | undefined = undefined;
    if (saveStatus === "scheduled") {
      if (scheduledAt && scheduledAt.trim()) {
        const parsed = new Date(scheduledAt);
        if (isNaN(parsed.getTime())) {
          toast.error(t("invalidScheduleDate"));
          return;
        }
        finalPublishedAt = parsed;
      } else {
        const fallback = new Date();
        fallback.setHours(fallback.getHours() + 1);
        finalPublishedAt = fallback;
      }
    }

    const payload = {
      title,
      slug: slug || generateSlug(title),
      contentMd: rawContent,
      contentHtml: rawContent,
      excerpt,
      coverImage,
      status: saveStatus,
      publishedAt: finalPublishedAt,
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
          slug: slug || generateSlug(title),
          contentMd: rawContent,
          contentHtml: rawContent,
          excerpt,
          coverImage,
          status: saveStatus,
          publishedAt: finalPublishedAt,
          locale,
        };

        if (initialPost?.id) {
          const res = await updatePage(initialPost.id, pagePayload);
          if (res.success) {
            setStatus(saveStatus);
            setSavedSnapshot(JSON.stringify({ title, slug: pagePayload.slug, contentHtml: rawContent, excerpt, coverImage }));
            toast.success(
              saveStatus === "published"
                ? t("pagePublishedUpdated")
                : saveStatus === "scheduled"
                ? t("pageScheduled")
                : saveStatus === "archived"
                ? t("pageArchived")
                : t("pageDraftSaved")
            );
            router.refresh();
          } else {
            const detail = res.errors ? Object.values(res.errors).flat().join(" ") : null;
            toast.error(detail || res.error || t("saveChangesError"));
          }
        } else {
          const res = await createPage(siteId, pagePayload);
          if (res.success) {
            setStatus(saveStatus);
            setSavedSnapshot(JSON.stringify({ title, slug: pagePayload.slug, contentHtml: rawContent, excerpt, coverImage }));
            toast.success(
              saveStatus === "published"
                ? t("pagePublished")
                : saveStatus === "scheduled"
                ? t("pageScheduled")
                : t("pageDraftCreated")
            );
            router.push(`/admin/pages/${res.pageId}`);
          } else {
            const detail = res.errors ? Object.values(res.errors).flat().join(" ") : null;
            toast.error(detail || res.error || t("pageCreateError"));
          }
        }
        return;
      }

      if (initialPost?.id) {
        const res = await updatePost(initialPost.id, payload);
        if (res.success) {
          setStatus(saveStatus);
          setSavedSnapshot(JSON.stringify({ title, slug: payload.slug, contentHtml: rawContent, excerpt, coverImage }));
          toast.success(
            saveStatus === "published"
              ? t("postPublishedUpdated")
              : saveStatus === "scheduled"
              ? t("postScheduled")
              : saveStatus === "archived"
              ? t("postArchived")
              : t("postDraftSaved")
          );
          router.refresh();
        } else {
          const detail = res.errors ? Object.values(res.errors).flat().join(" ") : null;
          toast.error(detail || res.error || t("saveChangesError"));
        }
      } else {
        const res = await createPost(siteId, payload);
        if (res.success) {
          setStatus(saveStatus);
          setSavedSnapshot(JSON.stringify({ title, slug: payload.slug, contentHtml: rawContent, excerpt, coverImage }));
          toast.success(
            saveStatus === "published"
              ? t("postPublished")
              : saveStatus === "scheduled"
              ? t("postScheduled")
              : t("postDraftCreated")
          );
          router.push(`/admin/posts/${res.postId}`);
        } else {
          const detail = res.errors ? Object.values(res.errors).flat().join(" ") : null;
          toast.error(detail || res.error || t("postCreateError"));
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
      const postSlug = slug || generateSlug(title);
      const fullUrl = `${currentOrigin}/entry/${postSlug}`;

      const res = await generateDubLinkAction({
        siteId,
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
      const res = await generateExcerptAction(siteId, text, title);
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
          setSlug(generateSlug(resTitle.translated));
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
    const duplicatedSlug = slug ? `${slug}-${targetTranslateLocale}` : generateSlug(duplicatedTitle);

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
      <PostEditorHeader
        mode={mode}
        status={status}
        wordCount={wordCount}
        readingTime={readingTime}
        showInspector={showInspector}
        isPending={isPending}
        onNavigateBack={handleNavigateBack}
        onToggleInspector={() => setShowInspector(!showInspector)}
        onOpenAiModal={() => setAiModalOpen(true)}
        onSaveDraft={() => handleSave("draft")}
        onSavePrimary={() => handleSave(status === "draft" ? "published" : status)}
      />

      {/* Main Grid: Left Editor + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Main Canvas */}
        <div className={`${showInspector ? "lg:col-span-8" : "lg:col-span-12"} space-y-4 min-w-0`}>
          {/* Title Box */}
          <div className="p-4 sm:p-6 bg-surface border border-border rounded-xl shadow-xs space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t("postTitlePlaceholder")}
              className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-0 text-text placeholder-text-muted/30 focus:outline-hidden focus:ring-0 leading-tight"
            />
          </div>

          <EditorToolbar
            editor={editor}
            inlineFileInputRef={inlineFileInputRef}
            isUploadingInline={isUploadingInline}
            onDirectInlineUpload={handleDirectInlineUpload}
            onOpenMediaPicker={() => openMediaPicker("editor")}
            onOpenLinkModal={openLinkModal}
            onOpenEmbedModal={() => setEmbedModalOpen(true)}
          />

          {/* Editor Canvas */}
          <div className="bg-surface border border-border rounded-xl p-3.5 sm:p-6 lg:p-8 min-h-[350px] sm:min-h-[500px] shadow-xs">
            <EditorContent editor={editor} className="prose-blog focus:outline-hidden" />
          </div>
        </div>

        {/* Right Inspector Sidebar */}
        {showInspector && (
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border space-y-3.5 shadow-xs">
              <PostPublishPanel
                mode={mode}
                title={title}
                slug={slug}
                onSlugChange={(nextSlug, manual) => {
                  setSlug(nextSlug);
                  setIsSlugManual(manual);
                }}
                locale={locale}
                onLocaleChange={setLocale}
                availableLanguageOptions={availableLanguageOptions}
                onOpenTranslateModal={openAiTranslateModal}
                status={status}
                onStatusChange={setStatus}
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                excerpt={excerpt}
                onExcerptChange={setExcerpt}
                aiLoading={aiLoading}
                onAiGenerateExcerpt={handleAiGenerateExcerpt}
                pinned={pinned}
                onPinnedChange={setPinned}
              />

              {mode === "post" && (
                <PostTaxonomyPanel
                  availableCategories={availableCategories}
                  selectedCategories={selectedCategories}
                  onChangeCategories={setSelectedCategories}
                  localTags={localTags}
                  selectedTags={selectedTags}
                  onChangeTags={setSelectedTags}
                  newTagInput={newTagInput}
                  onNewTagInputChange={setNewTagInput}
                  onAddTag={handleAddTag}
                />
              )}

              {mode === "post" && isDubEnabled && (
                <PostDubPanel
                  shortUrl={shortUrl}
                  qrCodeUrl={qrCodeUrl}
                  title={title}
                  slug={slug}
                  dubModalOpen={dubModalOpen}
                  setDubModalOpen={setDubModalOpen}
                  qrModalOpen={qrModalOpen}
                  setQrModalOpen={setQrModalOpen}
                  utmSource={utmSource}
                  setUtmSource={setUtmSource}
                  utmMedium={utmMedium}
                  setUtmMedium={setUtmMedium}
                  utmCampaign={utmCampaign}
                  setUtmCampaign={setUtmCampaign}
                  isGeneratingDub={isGeneratingDub}
                  onGenerateDubLink={handleGenerateDubLink}
                />
              )}
            </div>

            <PostCoverImageField
              coverImage={coverImage}
              onChangeCoverImage={setCoverImage}
              coverFileInputRef={coverFileInputRef}
              isUploadingCover={isUploadingCover}
              onDirectCoverUpload={handleDirectCoverUpload}
              onOpenLibrary={() => openMediaPicker("cover")}
            />
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

      <PostAiModals
        hasExistingId={Boolean(initialPost?.id)}
        availableLanguageOptions={availableLanguageOptions}
        aiModalOpen={aiModalOpen}
        setAiModalOpen={setAiModalOpen}
        aiInstruction={aiInstruction}
        setAiInstruction={setAiInstruction}
        aiLoading={aiLoading}
        onAiAssist={handleAiAssist}
        aiTranslateModalOpen={aiTranslateModalOpen}
        setAiTranslateModalOpen={setAiTranslateModalOpen}
        targetTranslateLocale={targetTranslateLocale}
        setTargetTranslateLocale={setTargetTranslateLocale}
        isTranslating={isTranslating}
        onAiTranslatePost={handleAiTranslatePost}
        onManualTranslatePost={handleManualTranslatePost}
      />

      <PostInsertModals
        embedModalOpen={embedModalOpen}
        setEmbedModalOpen={setEmbedModalOpen}
        embedUrl={embedUrl}
        setEmbedUrl={setEmbedUrl}
        onInsertEmbed={handleInsertEmbed}
        linkModalOpen={linkModalOpen}
        setLinkModalOpen={setLinkModalOpen}
        linkUrl={linkUrl}
        setLinkUrl={setLinkUrl}
        hasActiveLink={Boolean(editor?.isActive("link"))}
        onSaveLink={handleSaveLink}
        onRemoveLink={handleRemoveLink}
      />

      <ConfirmModal
        isOpen={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          router.push(backHref);
        }}
        title={t("unsavedChangesTitle")}
        message={t("unsavedChangesDesc")}
        confirmText={t("discardAndLeave")}
        cancelText={tc("cancel")}
        variant="warning"
      />
    </div>
  );
}
