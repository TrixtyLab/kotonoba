"use client";

import React, { useState, useMemo } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { createTag } from "@/actions/tags";
import { useRouter, type Locale } from "@/i18n/routing";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { PostEditorHeader } from "@/components/admin/editor/PostEditorHeader";
import { PostEditorCanvas } from "@/components/admin/editor/PostEditorCanvas";
import { PostPublishPanel } from "@/components/admin/editor/PostPublishPanel";
import { PostTaxonomyPanel } from "@/components/admin/editor/PostTaxonomyPanel";
import { PostCoverImageField } from "@/components/admin/editor/PostCoverImageField";
import { PostDubPanel } from "@/components/admin/editor/PostDubPanel";
import { PostAiModals } from "@/components/admin/editor/PostAiModals";
import { PostInsertModals } from "@/components/admin/editor/PostInsertModals";
import { AutoExitBlockOnEnter } from "@/components/admin/editor/tiptapExtensions";
import {
  ALL_LANGUAGE_OPTIONS,
  buildEditorSnapshot,
  resolveAllowedLocales,
  resolveIframeEmbedPaste,
  resolveInitialEditorHtml,
  resolveInitialPostDefaults,
  type InitialPostRecord,
} from "@/components/admin/editor/postEditorHelpers";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useEditorMediaAndEmbeds } from "@/hooks/useEditorMediaAndEmbeds";
import { usePostAiActions } from "@/hooks/usePostAiActions";
import { usePostSave } from "@/hooks/usePostSave";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";
import { generateSlug } from "@/lib/utils/slug";

/** Configuration properties for the rich-text article editor. */
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
  initialPost?: InitialPostRecord;
  /** List of available categories for taxonomy assignment. */
  availableCategories?: Array<{ id: string; name: string }>;
  /** List of available tags for taxonomy assignment. */
  availableTags?: Array<{ id: string; name: string }>;
}

/**
 * Full-featured WYSIWYG rich-text article editor with TipTap engine, AI assistants, Dub.co link provisioning, and canonical HTML saving.
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

  const initialHtml = useMemo(() => resolveInitialEditorHtml(initialPost), [initialPost]);
  const allowedLocales = useMemo(() => resolveAllowedLocales(supportedLocales), [supportedLocales]);
  const availableLanguageOptions = useMemo(
    () => ALL_LANGUAGE_OPTIONS.filter((opt) => allowedLocales.includes(opt.value)),
    [allowedLocales]
  );
  const initialDefaults = useMemo(
    () => resolveInitialPostDefaults(initialPost, allowedLocales[0]),
    [initialPost, allowedLocales]
  );

  const [title, setTitle] = useState(initialDefaults.title);
  const [slug, setSlug] = useState(initialDefaults.slug);
  const [isSlugManual, setIsSlugManual] = useState(initialDefaults.isSlugManual);
  const [contentHtml, setContentHtml] = useState(initialHtml);
  const [excerpt, setExcerpt] = useState(initialDefaults.excerpt);
  const [coverImage, setCoverImage] = useState(initialDefaults.coverImage);
  const [status, setStatus] = useState<PostStatus>(initialDefaults.status);
  const [scheduledAt, setScheduledAt] = useState<string>(initialDefaults.scheduledAt);
  const [locale, setLocale] = useState<Locale>(initialDefaults.locale);
  const [pinned, setPinned] = useState(initialDefaults.pinned);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialDefaults.categories);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialDefaults.tags);
  const [localTags, setLocalTags] = useState<Array<{ id: string; name: string }>>(availableTags);
  const [newTagInput, setNewTagInput] = useState("");
  const [showInspector, setShowInspector] = useState(true);
  const [, setEditorTick] = useState(0);

  const backHref = mode === "page" ? "/admin/pages" : "/admin/posts";
  const currentSnapshot = buildEditorSnapshot({ title, slug, contentHtml, excerpt, coverImage });
  const unsavedGuard = useUnsavedChangesGuard(currentSnapshot, () => router.push(backHref));

  const editor: Editor | null = useEditor({
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
        HTMLAttributes: { class: "rounded-xl border border-border shadow-xs my-5 mx-auto max-w-full" },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-accent underline underline-offset-2" },
      }),
      Placeholder.configure({ placeholder: t("contentPlaceholder") }),
    ],
    editorProps: {
      handlePaste: (_view, event): boolean => {
        const parsed = resolveIframeEmbedPaste(event);
        if (!parsed) return false;
        editor?.commands.insertContent(parsed.shortcodeHtml);
        toast.success(t(parsed.toastKey));
        return true;
      },
    },
    content: initialHtml,
    onUpdate: ({ editor: activeEditor }) => {
      setContentHtml(activeEditor.getHTML());
      if (activeEditor.isEmpty) activeEditor.commands.unsetAllMarks();
      setEditorTick((tick) => tick + 1);
    },
    onSelectionUpdate: () => setEditorTick((tick) => tick + 1),
    onTransaction: () => setEditorTick((tick) => tick + 1),
  });

  const mediaTools = useEditorMediaAndEmbeds({ editor, onAssignCoverImage: setCoverImage });

  const aiActions = usePostAiActions({
    siteId,
    mode,
    postId: initialPost?.id,
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
    onSetTitle: setTitle,
    onSetSlug: setSlug,
    onSetExcerpt: setExcerpt,
    onSetContentHtml: setContentHtml,
    onSetLocale: setLocale,
  });

  const saveActions = usePostSave({
    siteId,
    mode,
    postId: initialPost?.id,
    initialShortUrl: initialPost?.shortUrl,
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
    onSetStatus: setStatus,
    markSavedSnapshot: unsavedGuard.markSavedSnapshot,
    buildSnapshot: buildEditorSnapshot,
  });

  const { wordCount, readingTime } = useMemo(() => {
    const textOnly = contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const words = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
    return { wordCount: words, readingTime: Math.max(1, Math.ceil(words / 200)) };
  }, [contentHtml]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (!isSlugManual) setSlug(generateSlug(newTitle));
  }

  async function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    const existing = localTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedTags.includes(existing.id)) setSelectedTags([...selectedTags, existing.id]);
      setNewTagInput("");
      return;
    }

    const res = await createTag(siteId, { name: trimmed, slug: generateSlug(trimmed) });
    if (res.success) {
      setLocalTags((prev) => [...prev, { id: res.id, name: trimmed }]);
      setSelectedTags((prev) => [...prev, res.id]);
      setNewTagInput("");
      toast.success(t("tagCreated", { tag: trimmed }));
    } else {
      toast.error(res.error || t("tagCreateError"));
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
        isPending={saveActions.isPending}
        onNavigateBack={unsavedGuard.handleNavigateBack}
        onToggleInspector={() => setShowInspector(!showInspector)}
        onOpenAiModal={() => aiActions.setAiModalOpen(true)}
        onSaveDraft={() => saveActions.handleSave(POST_STATUS.DRAFT)}
        onSavePrimary={() => saveActions.handleSave(status === POST_STATUS.DRAFT ? POST_STATUS.PUBLISHED : status)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <PostEditorCanvas
          title={title}
          onTitleChange={handleTitleChange}
          showInspector={showInspector}
          editor={editor}
          inlineFileInputRef={mediaTools.inlineFileInputRef}
          isUploadingInline={mediaTools.isUploadingInline}
          onDirectInlineUpload={mediaTools.handleDirectInlineUpload}
          onOpenMediaPicker={() => mediaTools.openMediaPicker("editor")}
          onOpenLinkModal={mediaTools.openLinkModal}
          onOpenEmbedModal={() => mediaTools.setEmbedModalOpen(true)}
        />

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
                onOpenTranslateModal={aiActions.openAiTranslateModal}
                status={status}
                onStatusChange={setStatus}
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                excerpt={excerpt}
                onExcerptChange={setExcerpt}
                aiLoading={aiActions.aiLoading}
                onAiGenerateExcerpt={aiActions.handleAiGenerateExcerpt}
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
                  shortUrl={saveActions.shortUrl}
                  qrCodeUrl={saveActions.qrCodeUrl}
                  title={title}
                  slug={slug}
                  dubModalOpen={saveActions.dubModalOpen}
                  setDubModalOpen={saveActions.setDubModalOpen}
                  qrModalOpen={saveActions.qrModalOpen}
                  setQrModalOpen={saveActions.setQrModalOpen}
                  utmSource={saveActions.utmSource}
                  setUtmSource={saveActions.setUtmSource}
                  utmMedium={saveActions.utmMedium}
                  setUtmMedium={saveActions.setUtmMedium}
                  utmCampaign={saveActions.utmCampaign}
                  setUtmCampaign={saveActions.setUtmCampaign}
                  isGeneratingDub={saveActions.isGeneratingDub}
                  onGenerateDubLink={saveActions.handleGenerateDubLink}
                />
              )}
            </div>

            <PostCoverImageField
              coverImage={coverImage}
              onChangeCoverImage={setCoverImage}
              coverFileInputRef={mediaTools.coverFileInputRef}
              isUploadingCover={mediaTools.isUploadingCover}
              onDirectCoverUpload={mediaTools.handleDirectCoverUpload}
              onOpenLibrary={() => mediaTools.openMediaPicker("cover")}
            />
          </div>
        )}
      </div>

      <MediaPickerModal
        isOpen={mediaTools.mediaPickerOpen}
        onClose={() => mediaTools.setMediaPickerOpen(false)}
        onSelect={mediaTools.handleMediaSelect}
        title={mediaTools.mediaTarget === "cover" ? t("selectCoverModalTitle") : t("insertImageModalTitle")}
      />

      <PostAiModals
        hasExistingId={Boolean(initialPost?.id)}
        availableLanguageOptions={availableLanguageOptions}
        aiModalOpen={aiActions.aiModalOpen}
        setAiModalOpen={aiActions.setAiModalOpen}
        aiInstruction={aiActions.aiInstruction}
        setAiInstruction={aiActions.setAiInstruction}
        aiLoading={aiActions.aiLoading}
        onAiAssist={aiActions.handleAiAssist}
        aiTranslateModalOpen={aiActions.aiTranslateModalOpen}
        setAiTranslateModalOpen={aiActions.setAiTranslateModalOpen}
        targetTranslateLocale={aiActions.targetTranslateLocale}
        setTargetTranslateLocale={aiActions.setTargetTranslateLocale}
        isTranslating={aiActions.isTranslating}
        onAiTranslatePost={aiActions.handleAiTranslatePost}
        onManualTranslatePost={aiActions.handleManualTranslatePost}
      />

      <PostInsertModals
        embedModalOpen={mediaTools.embedModalOpen}
        setEmbedModalOpen={mediaTools.setEmbedModalOpen}
        embedUrl={mediaTools.embedUrl}
        setEmbedUrl={mediaTools.setEmbedUrl}
        onInsertEmbed={mediaTools.handleInsertEmbed}
        linkModalOpen={mediaTools.linkModalOpen}
        setLinkModalOpen={mediaTools.setLinkModalOpen}
        linkUrl={mediaTools.linkUrl}
        setLinkUrl={mediaTools.setLinkUrl}
        hasActiveLink={Boolean(editor?.isActive("link"))}
        onSaveLink={mediaTools.handleSaveLink}
        onRemoveLink={mediaTools.handleRemoveLink}
      />

      <ConfirmModal
        isOpen={unsavedGuard.leaveConfirmOpen}
        onClose={() => unsavedGuard.setLeaveConfirmOpen(false)}
        onConfirm={unsavedGuard.handleConfirmLeave}
        title={t("unsavedChangesTitle")}
        message={t("unsavedChangesDesc")}
        confirmText={t("discardAndLeave")}
        cancelText={tc("cancel")}
        variant="warning"
      />
    </div>
  );
}
