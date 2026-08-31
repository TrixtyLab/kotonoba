"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { deletePost } from "@/actions/posts";
import { Search, Eye, Edit3, Trash2, Pin, ExternalLink, Plus, FileText, BarChart3 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

/**
 * Summary representation of an article displayed in the administrative posts table.
 */
export interface PostItem {
  /** Database identifier of the post. */
  id: string;
  /** Article title. */
  title: string;
  /** URL slug string. */
  slug: string;
  /** Publication lifecycle status. */
  status: "draft" | "published" | "scheduled" | "archived";
  /** Language locale code. */
  locale: string;
  /** View count metric. */
  views: number;
  /** Pinned highlight flag. */
  pinned: boolean;
  /** Formatted publication timestamp. */
  publishedAtFormatted?: string | null;
  /** Formatted creation timestamp. */
  createdAtFormatted: string;
  /** Author display name. */
  authorName?: string | null;
}

/**
 * Administrative posts management table with real-time text search, status filters, and confirmation modal deletion flows.
 *
 * @param props - Object containing the initial array of PostItem records.
 * @returns React JSX posts list view.
 */
export function PostsListClient({ initialPosts }: { initialPosts: PostItem[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const ta = useTranslations("analytics");
  const toast = useToast();
  const [posts, setPosts] = useState(initialPosts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [posts, search, statusFilter]);

  async function handleConfirmDelete() {
    if (!postToDelete) return;
    const id = postToDelete;
    startTransition(async () => {
      const res = await deletePost(id);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        toast.success(t("postDeleted"));
      } else {
        toast.error(t("postDeleteError"));
      }
      setPostToDelete(null);
    });
  }

  const statusOptions = [
    { key: "all", label: tc("all"), count: posts.length },
    { key: "published", label: t("publishedPosts"), count: posts.filter((p) => p.status === "published").length },
    { key: "scheduled", label: t("scheduledPosts"), count: posts.filter((p) => p.status === "scheduled").length },
    { key: "draft", label: t("draftPosts"), count: posts.filter((p) => p.status === "draft").length },
    { key: "archived", label: t("statusArchived"), count: posts.filter((p) => p.status === "archived").length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{tc("posts")}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("postsSubtitle", { count: posts.length })}
          </p>
        </div>

        <Link href="/admin/posts/new">
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            {t("newPost")}
          </Button>
        </Link>
      </div>

      {/* Filter toolbar */}
      <div className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t("searchPostsPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-hover/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-muted/50 focus:outline-hidden focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-lg w-full sm:w-auto border border-border/50">
          {statusOptions.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStatusFilter(st.key)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                statusFilter === st.key
                  ? "bg-surface text-text shadow-2xs border border-border"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <span>{st.label}</span>
              <span className="text-[10px] text-text-muted opacity-80">({st.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-hover/50 text-text-muted border-b border-border font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">{tc("title")}</th>
                <th className="p-3.5">{tc("status")}</th>
                <th className="p-3.5">{tc("language")}</th>
                <th className="p-3.5">{tc("views")}</th>
                <th className="p-3.5">{tc("date")}</th>
                <th className="p-3.5 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-text">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-surface-hover/40 transition-colors group">
                  <td className="p-3.5 font-medium max-w-xs sm:max-w-md">
                    <div className="flex items-center gap-2">
                      {post.pinned && <Pin className="w-3.5 h-3.5 text-accent shrink-0" />}
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="font-semibold text-xs text-text group-hover:text-accent transition-colors block truncate"
                      >
                        {post.title}
                      </Link>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono block truncate mt-0.5">
                      /entry/{post.slug}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <Badge variant={post.status === "published" ? "success" : post.status === "scheduled" ? "primary" : post.status === "archived" ? "secondary" : "warning"}>
                      {post.status === "published" ? t("statusPublished") : post.status === "scheduled" ? t("statusScheduled") : post.status === "archived" ? t("statusArchived") : t("statusDraft")}
                    </Badge>
                  </td>
                  <td className="p-3.5 uppercase font-mono text-[10px] text-text-muted font-semibold">
                    {post.locale}
                  </td>
                  <td className="p-3.5 font-mono text-xs">
                    <Link
                      href={`/admin/analytics/${post.id}`}
                      className="inline-flex items-center gap-1 text-text-muted hover:text-accent font-semibold transition-colors"
                      title={ta("viewDetailedAnalytics")}
                    >
                      <Eye className="w-3 h-3" />
                      <span>{post.views}</span>
                    </Link>
                  </td>
                  <td className="p-3.5 text-text-muted text-xs whitespace-nowrap">
                    {post.publishedAtFormatted || post.createdAtFormatted}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/analytics/${post.id}`}
                        className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                        title={ta("viewDetailedAnalytics")}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </Link>
                      {post.status === "published" && (
                        <Link
                          href={`/entry/${post.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                          title={tc("view")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                        title={tc("edit")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPostToDelete(post.id)}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
                        title={tc("delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-muted">
                    <FileText className="w-6 h-6 opacity-30 mx-auto mb-1.5" />
                    {t("noPostsFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(postToDelete)}
        onClose={() => setPostToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t("deletePost")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
