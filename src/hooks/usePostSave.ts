"use client";

import { useState, useTransition } from "react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useRouter, type Locale } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { createPost, updatePost } from "@/actions/posts";
import { createPage, updatePage } from "@/actions/pages";
import { generateDubLinkAction } from "@/actions/dub";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";
import { generateSlug } from "@/lib/utils/slug";

interface UsePostSaveOptions {
  siteId: string;
  mode: "post" | "page";
  postId?: string;
  initialShortUrl?: string | null;
  editor: Editor | null;
  title: string;
  slug: string;
  contentHtml: string;
  excerpt: string;
  coverImage: string;
  status: PostStatus;
  scheduledAt: string;
  locale: Locale;
  pinned: boolean;
  selectedCategories: string[];
  selectedTags: string[];
  onSetStatus: (status: PostStatus) => void;
  markSavedSnapshot: (snapshot: string) => void;
  buildSnapshot: (state: {
    title: string;
    slug: string;
    contentHtml: string;
    excerpt: string;
    coverImage: string;
  }) => string;
}

const SAVE_SUCCESS_KEYS = {
  page: {
    existing: {
      published: "pagePublishedUpdated",
      scheduled: "pageScheduled",
      archived: "pageArchived",
      draft: "pageDraftSaved",
    },
    fresh: {
      published: "pagePublished",
      scheduled: "pageScheduled",
      archived: "pageDraftCreated",
      draft: "pageDraftCreated",
    },
  },
  post: {
    existing: {
      published: "postPublishedUpdated",
      scheduled: "postScheduled",
      archived: "postArchived",
      draft: "postDraftSaved",
    },
    fresh: {
      published: "postPublished",
      scheduled: "postScheduled",
      archived: "postDraftCreated",
      draft: "postDraftCreated",
    },
  },
} as const;

function resolveScheduledDate(scheduledAt: string): Date | null {
  if (scheduledAt && scheduledAt.trim()) {
    const parsed = new Date(scheduledAt);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const fallback = new Date();
  fallback.setHours(fallback.getHours() + 1);
  return fallback;
}

/**
 * Coordinates article/page persistence transitions, canonical HTML saving, toast notifications,
 * and optional Dub.co short-link provisioning for the editor workspace.
 */
export function usePostSave({
  siteId,
  mode,
  postId,
  initialShortUrl,
  editor,
  title,
  slug,
  contentHtml,
  excerpt,
  coverImage,
  status,
  scheduledAt,
  locale,
  pinned,
  selectedCategories,
  selectedTags,
  onSetStatus,
  markSavedSnapshot,
  buildSnapshot,
}: UsePostSaveOptions) {
  const t = useTranslations("editor");
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [shortUrl, setShortUrl] = useState(initialShortUrl || "");
  const [dubModalOpen, setDubModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(
    initialShortUrl ? `https://api.dub.co/qr?url=${encodeURIComponent(initialShortUrl)}` : ""
  );
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [isGeneratingDub, setIsGeneratingDub] = useState(false);

  async function handleSave(forcedStatus?: PostStatus) {
    const saveStatus = forcedStatus ?? status;
    const rawContent = editor ? editor.getHTML() : contentHtml;
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }

    let finalPublishedAt: Date | undefined;
    if (saveStatus === POST_STATUS.SCHEDULED) {
      const resolved = resolveScheduledDate(scheduledAt);
      if (!resolved) {
        toast.error(t("invalidScheduleDate"));
        return;
      }
      finalPublishedAt = resolved;
    }

    const nextSlug = slug || generateSlug(title);
    const basePayload = {
      title,
      slug: nextSlug,
      content: rawContent,
      contentMd: "",
      contentHtml: rawContent,
      contentFormat: "html" as const,
      excerpt,
      coverImage,
      status: saveStatus,
      publishedAt: finalPublishedAt,
      locale,
    };

    const handleSaveOutcome = (
      res: { success: boolean; error?: string; errors?: Record<string, string[]>; pageId?: string; postId?: string },
      kind: "page" | "post"
    ) => {
      if (res.success) {
        onSetStatus(saveStatus);
        markSavedSnapshot(buildSnapshot({ title, slug: nextSlug, contentHtml: rawContent, excerpt, coverImage }));
        const key = SAVE_SUCCESS_KEYS[kind][postId ? "existing" : "fresh"][saveStatus];
        toast.success(t(key));
        if (postId) router.refresh();
        else router.push(kind === "page" ? `/admin/pages/${res.pageId}` : `/admin/posts/${res.postId}`);
        return;
      }
      const detail = res.errors ? Object.values(res.errors).flat().join(" ") : null;
      const fallbackKey = kind === "page" ? "pageCreateError" : "postCreateError";
      toast.error(detail || res.error || (postId ? t("saveChangesError") : t(fallbackKey)));
    };

    startTransition(async () => {
      if (mode === "page") {
        const res = postId
          ? await updatePage(postId, basePayload)
          : await createPage(siteId, basePayload);
        handleSaveOutcome(res, "page");
        return;
      }

      const postPayload = {
        ...basePayload,
        pinned,
        shortUrl: shortUrl || undefined,
        categoryIds: selectedCategories,
        tagIds: selectedTags,
      };
      const res = postId
        ? await updatePost(postId, postPayload)
        : await createPost(siteId, postPayload);
      handleSaveOutcome(res, "post");
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
      const res = await generateDubLinkAction({
        siteId,
        postId,
        originalUrl: `${currentOrigin}/entry/${postSlug}`,
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

  return {
    isPending,
    shortUrl,
    dubModalOpen,
    setDubModalOpen,
    qrModalOpen,
    setQrModalOpen,
    qrCodeUrl,
    utmSource,
    setUtmSource,
    utmMedium,
    setUtmMedium,
    utmCampaign,
    setUtmCampaign,
    isGeneratingDub,
    handleSave,
    handleGenerateDubLink,
  };
}
