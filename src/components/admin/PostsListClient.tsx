"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deletePost } from "@/actions/posts";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { Search, Eye, Edit3, Trash2, Pin, ExternalLink, Plus, FileText, BarChart3 } from "lucide-react";

/** Summary representation of an article displayed in the administrative posts table. */
export interface PostItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  locale: string;
  views: number;
  pinned: boolean;
  publishedAtFormatted?: string | null;
  createdAtFormatted: string;
  authorId?: string | null;
  authorName?: string | null;
}

/** Signed-in editor viewing the list. Authors only see delete on their own rows. */
export interface ContentListViewer {
  id: string;
  role: string;
}

/** Properties configuring the administrative posts list view. */
export interface PostsListClientProps {
  initialPosts: PostItem[];
  viewer: ContentListViewer;
}

/**
 * Administrative posts management table with real-time search, tab status filtering, and delete confirmation.
 */
export function PostsListClient({ initialPosts, viewer }: PostsListClientProps): React.JSX.Element {
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
    const q = search.toLowerCase();
    return posts.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(q) || p.slug.includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [posts, search, statusFilter]);

  function canDelete(post: PostItem): boolean {
    if (viewer.role === "author") return post.authorId === viewer.id;
    return true;
  }

  async function handleConfirmDelete(): Promise<void> {
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
    { key: POST_STATUS.PUBLISHED, label: t("publishedPosts"), count: posts.filter((p) => p.status === POST_STATUS.PUBLISHED).length },
    { key: POST_STATUS.SCHEDULED, label: t("scheduledPosts"), count: posts.filter((p) => p.status === POST_STATUS.SCHEDULED).length },
    { key: POST_STATUS.DRAFT, label: t("draftPosts"), count: posts.filter((p) => p.status === POST_STATUS.DRAFT).length },
    { key: POST_STATUS.ARCHIVED, label: t("statusArchived"), count: posts.filter((p) => p.status === POST_STATUS.ARCHIVED).length },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={tc("posts")}
        subtitle={t("postsSubtitle", { count: posts.length })}
        icon={<FileText className="w-5 h-5" />}
        actions={
          <Link href="/admin/posts/new">
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              {t("newPost")}
            </Button>
          </Link>
        }
      />

      <div className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t("searchPostsPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 min-h-[40px] text-sm text-text placeholder:text-text-muted placeholder:italic focus:outline-hidden focus:border-accent"
          />
        </div>

        <Tabs items={statusOptions} activeKey={statusFilter} onSelect={setStatusFilter} variant="surface" />
      </div>

      <AdminDataTable
        columns={[
          { key: "title", label: tc("title") },
          { key: "status", label: tc("status"), className: "hidden sm:table-cell" },
          { key: "language", label: tc("language"), className: "hidden md:table-cell" },
          { key: "views", label: tc("views"), className: "hidden sm:table-cell" },
          { key: "date", label: tc("date"), className: "hidden md:table-cell" },
          { key: "actions", label: tc("actions"), className: "text-right hidden sm:table-cell" },
        ]}
        isEmpty={filteredPosts.length === 0}
        emptyIcon={<FileText className="w-6 h-6" />}
        emptyTitle={t("noPostsFound")}
      >
        {filteredPosts.map((post) => (
          <tr key={post.id} className="hover:bg-surface-hover/40 transition-colors group">
            <td className="p-3.5 font-medium max-w-xs sm:max-w-md">
              <div className="flex items-center gap-2">
                {post.pinned && <Pin className="w-3.5 h-3.5 text-accent shrink-0" />}
                <Link href={`/admin/posts/${post.id}`} className="font-semibold text-sm text-text group-hover:text-accent transition-colors block truncate">
                  {post.title}
                </Link>
              </div>
              <span className="text-xs text-text-muted font-mono block truncate mt-0.5">/entry/{post.slug}</span>

              <div className="flex items-center gap-1.5 mt-1.5 sm:hidden flex-wrap">
                <StatusBadge status={post.status} />
                <span className="uppercase text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border/50 font-mono">
                  {post.locale}
                </span>
                <span className="text-[10px] text-text-muted flex items-center gap-0.5 font-mono">
                  <Eye className="w-2.5 h-2.5" /> {post.views}
                </span>
                <span className="text-[10px] text-text-muted">{post.publishedAtFormatted || post.createdAtFormatted}</span>
              </div>
              <div className="flex items-center gap-1 mt-2 sm:hidden">
                <Link href={`/admin/analytics/${post.id}`} className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title={ta("viewDetailedAnalytics")}>
                  <BarChart3 className="w-3.5 h-3.5" />
                </Link>
                {post.status === POST_STATUS.PUBLISHED && (
                  <Link href={`/entry/${post.slug}`} target="_blank" className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title={tc("view")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Link href={`/admin/posts/${post.id}`} className="p-2 rounded-lg text-text-muted hover:text-accent hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title={tc("edit")}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Link>
                {canDelete(post) && (
                  <button type="button" onClick={() => setPostToDelete(post.id)} className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title={tc("delete")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </td>
            <td className="p-3.5 hidden sm:table-cell">
              <StatusBadge status={post.status} />
            </td>
            <td className="p-3.5 uppercase font-mono text-[10px] text-text-muted font-semibold hidden md:table-cell">{post.locale}</td>
            <td className="p-3.5 font-mono text-xs hidden sm:table-cell">
              <Link href={`/admin/analytics/${post.id}`} className="inline-flex items-center gap-1 text-text-muted hover:text-accent font-semibold transition-colors" title={ta("viewDetailedAnalytics")}>
                <Eye className="w-3 h-3" />
                <span>{post.views}</span>
              </Link>
            </td>
            <td className="p-3.5 text-text-muted text-xs whitespace-nowrap hidden md:table-cell">
              {post.publishedAtFormatted || post.createdAtFormatted}
            </td>
            <td className="p-3.5 text-right hidden sm:table-cell">
              <div className="flex items-center justify-end gap-1 flex-wrap">
                <Link href={`/admin/analytics/${post.id}`} className="p-2 sm:p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={ta("viewDetailedAnalytics")}>
                  <BarChart3 className="w-3.5 h-3.5" />
                </Link>
                {post.status === POST_STATUS.PUBLISHED && (
                  <Link href={`/entry/${post.slug}`} target="_blank" className="p-2 sm:p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={tc("view")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Link href={`/admin/posts/${post.id}`} className="p-2 sm:p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={tc("edit")}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Link>
                {canDelete(post) && (
                  <button type="button" onClick={() => setPostToDelete(post.id)} className="p-2 sm:p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={tc("delete")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>

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
