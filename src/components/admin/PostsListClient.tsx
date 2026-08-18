"use client";

import { useState, useTransition, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/Badge";
import { deletePost } from "@/actions/posts";
import { Search, Eye, Edit3, Trash2, Pin, ExternalLink } from "lucide-react";

export interface PostItem {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  locale: string;
  views: number;
  pinned: boolean;
  publishedAtFormatted?: string | null;
  createdAtFormatted: string;
  authorName?: string | null;
}

/**
 * Interactive client-side posts list with search input, status tab filters, and inline delete buttons.
 */
export function PostsListClient({ initialPosts }: { initialPosts: PostItem[] }) {
  const tCommon = useTranslations("common");
  const tAdmin = useTranslations("admin");
  const [posts, setPosts] = useState(initialPosts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [posts, search, statusFilter]);

  async function handleDelete(postId: string) {
    if (!confirm(tCommon("confirmDelete"))) {
      return;
    }
    startTransition(async () => {
      const res = await deletePost(postId);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    });
  }

  const statusOptions = [
    { key: "all", label: tCommon("all") },
    { key: "published", label: tAdmin("statusPublished") },
    { key: "draft", label: tAdmin("statusDraft") },
    { key: "archived", label: tAdmin("statusArchived") },
  ];

  return (
    <div className="space-y-4">
      <div className="glass p-3 rounded-xl border border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
          <input
            type="text"
            placeholder={tAdmin("searchPostsPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg w-full sm:w-auto">
          {statusOptions.map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                statusFilter === st.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/80 text-text-muted border-b border-border font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">{tCommon("title")}</th>
                <th className="p-3.5">{tCommon("status")}</th>
                <th className="p-3.5">{tCommon("language")}</th>
                <th className="p-3.5">{tCommon("views")}</th>
                <th className="p-3.5">{tCommon("date")}</th>
                <th className="p-3.5 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="p-3.5 font-medium max-w-xs sm:max-w-md">
                    <div className="flex items-center gap-2">
                      {post.pinned && <Pin className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="font-semibold text-text hover:text-primary transition-colors block truncate"
                      >
                        {post.title}
                      </Link>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono block truncate">
                      /entry/{post.slug}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <Badge variant={post.status === "published" ? "success" : post.status === "archived" ? "secondary" : "warning"}>
                      {post.status === "published" ? tAdmin("statusPublished") : post.status === "archived" ? tAdmin("statusArchived") : tAdmin("statusDraft")}
                    </Badge>
                  </td>
                  <td className="p-3.5 uppercase font-mono text-[11px] text-text-muted">
                    {post.locale}
                  </td>
                  <td className="p-3.5 font-mono text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3 h-3 text-text-muted" />
                      {post.views}
                    </span>
                  </td>
                  <td className="p-3.5 text-text-muted whitespace-nowrap">
                    {post.publishedAtFormatted || post.createdAtFormatted}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {post.status === "published" && (
                        <Link
                          href={`/entry/${post.slug}`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text"
                          title={tAdmin("viewPost")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        href={`/admin/posts/${post.id}`}
                        className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-primary"
                        title={tAdmin("editPost")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger"
                        title={tAdmin("deletePost")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    {tAdmin("noPostsFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
