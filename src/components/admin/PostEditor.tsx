"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { createPost, updatePost } from "@/actions/posts";
import { generateSeoAction, generateExcerptAction, rewriteAction, translateAction } from "@/actions/ai";
import { useRouter } from "@/i18n/routing";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Undo, Redo, Image as ImageIcon,
  Sparkles, Save, Globe, Eye, Code2, Tag, Folder, ArrowLeft, Upload
} from "lucide-react";

export interface PostEditorProps {
  siteId: string;
  initialPost?: {
    id: string;
    title: string;
    slug: string;
    contentMd: string;
    excerpt: string;
    coverImage: string | null;
    status: "draft" | "published" | "archived";
    locale: string;
    pinned: boolean;
    categories?: string[];
    tags?: string[];
  };
  availableCategories: Array<{ id: string; name: string }>;
  availableTags: Array<{ id: string; name: string }>;
}

/**
 * Full-featured post editor integrating Tiptap WYSIWYG, live Mermaid diagram previews,
 * AI writing assistance, SEO metadata generation, and responsive management panes.
 */
export function PostEditor({ siteId, initialPost, availableCategories, availableTags }: PostEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialPost?.title || "");
  const [slug, setSlug] = useState(initialPost?.slug || "");
  const [contentMd, setContentMd] = useState(initialPost?.contentMd || "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || "");
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(initialPost?.status || "draft");
  const [locale, setLocale] = useState(initialPost?.locale || "en");
  const [pinned, setPinned] = useState(initialPost?.pinned || false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPost?.categories || []);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialPost?.tags || []);
  const [newTagInput, setNewTagInput] = useState("");

  const [viewMode, setViewMode] = useState<"visual" | "markdown" | "preview">("visual");
  const [isUploading, setIsUploading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ImageExtension,
      LinkExtension.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing your article, or type markdown directly…",
      }),
    ],
    content: initialPost?.contentMd || "",
    onUpdate: ({ editor }) => {
      setContentMd(editor.getHTML());
    },
  });

  const extractMermaidDiagrams = useCallback((text: string) => {
    const regex = /```mermaid\n([\s\S]*?)```/g;
    const diagrams: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      diagrams.push(match[1].trim());
    }
    return diagrams;
  }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setCoverImage(data.url);
        editor?.chain().focus().setImage({ src: data.url }).run();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to upload image." });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave(newStatus?: "draft" | "published" | "archived") {
    const saveStatus = newStatus || status;
    const rawContent = editor ? editor.getHTML() : contentMd;

    const payload = {
      title,
      slug,
      contentMd: rawContent,
      contentHtml: rawContent,
      excerpt,
      coverImage,
      status: saveStatus,
      locale,
      pinned,
      categoryIds: selectedCategories,
      tagIds: selectedTags,
    };

    startTransition(async () => {
      let res;
      if (initialPost?.id) {
        res = await updatePost(initialPost.id, payload);
      } else {
        res = await createPost(siteId, payload);
      }

      if (res.success) {
        setStatus(saveStatus);
        setFeedback({ type: "success", message: "Article saved successfully!" });
        if (!initialPost?.id && "postId" in res && res.postId) {
          router.push(`/admin/posts/${res.postId}`);
        }
      } else {
        const errorMsg = res.error || (res.errors ? Object.values(res.errors).flat().join(", ") : "Validation error");
        setFeedback({ type: "error", message: errorMsg });
      }
    });
  }

  async function handleAiGenerateSeo() {
    setAiLoading(true);
    const res = await generateSeoAction(siteId, contentMd);
    setAiLoading(false);
    if (res.success) {
      setExcerpt(res.data.description || excerpt);
      setFeedback({ type: "success", message: "SEO metadata generated by AI!" });
    } else {
      setFeedback({ type: "error", message: res.error });
    }
  }

  async function handleAiGenerateExcerpt() {
    setAiLoading(true);
    const res = await generateExcerptAction(siteId, contentMd);
    setAiLoading(false);
    if (res.success) {
      setExcerpt(res.excerpt);
      setFeedback({ type: "success", message: "Excerpt generated by AI!" });
    } else {
      setFeedback({ type: "error", message: res.error });
    }
  }

  async function handleAiAssist() {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    const res = await rewriteAction(siteId, contentMd, aiInstruction);
    setAiLoading(false);
    setAiModalOpen(false);
    if (res.success) {
      setContentMd(res.result);
      editor?.commands.setContent(res.result);
      setFeedback({ type: "success", message: "AI revision applied!" });
    } else {
      setFeedback({ type: "error", message: res.error });
    }
  }

  function handleAddTag() {
    if (!newTagInput.trim()) return;
    const existing = availableTags.find((t) => t.name.toLowerCase() === newTagInput.trim().toLowerCase());
    if (existing && !selectedTags.includes(existing.id)) {
      setSelectedTags([...selectedTags, existing.id]);
    }
    setNewTagInput("");
  }

  const mermaidDiagrams = extractMermaidDiagrams(contentMd);

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded-md text-sm flex items-center justify-between animate-slide-down ${
            feedback.type === "success" ? "bg-success/15 text-success border border-success/30" : "bg-danger/15 text-danger border border-danger/30"
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/posts")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Posts
          </Button>
          <span className="text-text-muted">/</span>
          <h1 className="text-xl font-bold text-text truncate max-w-[200px] sm:max-w-md">
            {title || "Untitled Article"}
          </h1>
          <Badge variant={status === "published" ? "success" : status === "archived" ? "secondary" : "warning"}>
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="secondary" size="sm" onClick={() => handleSave("draft")} loading={isPending}>
            <Save className="w-4 h-4 mr-1" />
            Save Draft
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSave("published")} loading={isPending}>
            Publish Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Input
            placeholder="Article Title…"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!initialPost?.slug) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
              }
            }}
            className="text-xl sm:text-2xl font-bold py-3 bg-surface/50 border-border"
          />

          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-md">
              <button
                onClick={() => setViewMode("visual")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === "visual" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                Visual Editor
              </button>
              <button
                onClick={() => setViewMode("markdown")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === "markdown" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                <Code2 className="w-3.5 h-3.5 inline mr-1" />
                Raw Markdown
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  viewMode === "preview" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                <Eye className="w-3.5 h-3.5 inline mr-1" />
                Live Preview
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiModalOpen(true)}
              className="text-primary hover:text-primary-hover font-semibold text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              AI Assistant
            </Button>
          </div>

          {viewMode === "visual" && (
            <div className="border border-border rounded-lg bg-surface/40 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 p-2 bg-surface border-b border-border text-text-muted">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("bold") ? "text-primary bg-primary/10" : ""}`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("italic") ? "text-primary bg-primary/10" : ""}`}
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("strike") ? "text-primary bg-primary/10" : ""}`}
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("code") ? "text-primary bg-primary/10" : ""}`}
                >
                  <Code className="w-4 h-4" />
                </button>
                <span className="w-px h-4 bg-border mx-1" />
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("heading", { level: 1 }) ? "text-primary bg-primary/10" : ""}`}
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("heading", { level: 2 }) ? "text-primary bg-primary/10" : ""}`}
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("heading", { level: 3 }) ? "text-primary bg-primary/10" : ""}`}
                >
                  <Heading3 className="w-4 h-4" />
                </button>
                <span className="w-px h-4 bg-border mx-1" />
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("bulletList") ? "text-primary bg-primary/10" : ""}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("orderedList") ? "text-primary bg-primary/10" : ""}`}
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  className={`p-1.5 rounded hover:bg-surface-hover ${editor?.isActive("blockquote") ? "text-primary bg-primary/10" : ""}`}
                >
                  <Quote className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                  className="p-1.5 rounded hover:bg-surface-hover"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-px h-4 bg-border mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    const snippet = "\n\n```mermaid\ngraph TD\n  A[Start] --> B[Process]\n  B --> C[Done]\n```\n\n";
                    editor?.chain().focus().insertContent(snippet).run();
                  }}
                  className="px-2 py-1 text-xs font-mono rounded bg-surface-hover hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  + Mermaid
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().undo()}
                    className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().redo()}
                    className="p-1.5 rounded hover:bg-surface-hover disabled:opacity-30"
                  >
                    <Redo className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <EditorContent editor={editor} className="min-h-[400px] p-4 focus:outline-none prose-blog" />
            </div>
          )}

          {viewMode === "markdown" && (
            <Textarea
              value={contentMd}
              onChange={(e) => {
                setContentMd(e.target.value);
                editor?.commands.setContent(e.target.value);
              }}
              className="min-h-[450px] font-mono text-sm leading-relaxed bg-surface/50 border-border"
              placeholder="Write raw markdown with Mermaid diagrams..."
            />
          )}

          {viewMode === "preview" && (
            <div className="border border-border rounded-lg p-6 bg-surface/40 min-h-[400px]">
              <div className="prose-blog" dangerouslySetInnerHTML={{ __html: contentMd }} />
              {mermaidDiagrams.map((chart, idx) => (
                <div key={idx} className="my-6">
                  <p className="text-xs font-mono text-text-muted mb-1">Diagram {idx + 1}:</p>
                  <MermaidRenderer chart={chart} />
                </div>
              ))}
            </div>
          )}

          {mermaidDiagrams.length > 0 && viewMode !== "preview" && (
            <div className="border border-border/80 rounded-lg p-4 bg-surface/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Live Mermaid Diagrams ({mermaidDiagrams.length})
              </h3>
              <div className="space-y-4">
                {mermaidDiagrams.map((chart, i) => (
                  <MermaidRenderer key={i} chart={chart} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass p-4 rounded-lg space-y-4 border border-border">
            <h3 className="text-sm font-semibold text-text border-b border-border/50 pb-2">Publishing Settings</h3>

            <Input
              label="URL Slug (/entry/[slug])"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-article-slug"
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Language
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              >
                <option value="en">English (en)</option>
                <option value="es">Español (es)</option>
                <option value="fr">Français (fr)</option>
                <option value="de">Deutsch (de)</option>
                <option value="pt">Português (pt)</option>
                <option value="zh">中文 (zh)</option>
                <option value="ja">日本語 (ja)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="pinned-checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="pinned-checkbox" className="text-sm font-medium text-text cursor-pointer">
                Pin to Featured Articles
              </label>
            </div>
          </div>

          <div className="glass p-4 rounded-lg space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold text-text">Cover Image</h3>
            </div>
            {coverImage && (
              <div className="relative rounded-md overflow-hidden border border-border h-32 w-full">
                <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setCoverImage("")}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded p-1 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            <Input
              placeholder="https://... image URL"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
            <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-border rounded-md text-xs text-text-muted hover:text-text hover:border-primary cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              {isUploading ? "Uploading…" : "Upload from Device"}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          <div className="glass p-4 rounded-lg space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold text-text">Categories</h3>
              <Folder className="w-4 h-4 text-text-muted" />
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {availableCategories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs text-text cursor-pointer hover:text-primary">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(c.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories([...selectedCategories, c.id]);
                      } else {
                        setSelectedCategories(selectedCategories.filter((id) => id !== c.id));
                      }
                    }}
                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {availableCategories.length === 0 && (
                <p className="text-xs text-text-muted">No categories created yet.</p>
              )}
            </div>
          </div>

          <div className="glass p-4 rounded-lg space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold text-text">Tags</h3>
              <Tag className="w-4 h-4 text-text-muted" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tId) => {
                const tagObj = availableTags.find((t) => t.id === tId);
                return (
                  <span
                    key={tId}
                    className="inline-flex items-center gap-1 text-[11px] bg-surface-hover px-2 py-0.5 rounded-full border border-border"
                  >
                    #{tagObj?.name || tId}
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter((id) => id !== tId))}
                      className="text-text-muted hover:text-danger"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag…"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleAddTag}>Add</Button>
            </div>
          </div>

          <div className="glass p-4 rounded-lg space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="text-sm font-semibold text-text">Excerpt & SEO</h3>
              <Button variant="ghost" size="sm" onClick={handleAiGenerateExcerpt} loading={aiLoading} className="text-xs text-primary p-0">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generate
              </Button>
            </div>
            <Textarea
              label="Article Excerpt"
              placeholder="Short summary for SEO and cards…"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
      </div>

      <Modal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} title="AI Writing Assistant">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Ask the AI assistant to rewrite, summarize, simplify, or generate new content based on your draft.
          </p>
          <Textarea
            label="Instruction"
            placeholder="e.g. 'Make the introduction more punchy and fix any grammar errors.'"
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            className="min-h-[90px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAiModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAiAssist} loading={aiLoading} icon={<Sparkles className="w-4 h-4" />}>
              Apply AI Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
