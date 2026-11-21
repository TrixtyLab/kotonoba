"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deletePage } from "@/actions/pages";
import { POST_STATUS, type PostStatus } from "@/lib/config/constants";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { Search, Eye, Edit3, Trash2, ExternalLink, Plus, Files } from "lucide-react";

/** Summary representation of a page displayed in the administrative pages table. */
export interface PageItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  locale: string;
  views: number;
  publishedAtFormatted?: string | null;
  createdAtFormatted: string;
  authorName?: string | null;
}

/** Properties configuring the administrative pages list view. */
export interface PagesListClientProps {
  initialPages: PageItem[];
}

/**
 * Administrative custom pages management table with search, tab status filters, and deletion.
 */
export function PagesListClient({ initialPages }: PagesListClientProps): React.JSX.Element {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const toast = useToast();
  const [pagesList, setPagesList] = useState(initialPages);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPages = useMemo(() => {
    const q = search.toLowerCase();
    return pagesList.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(q) || p.slug.includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pagesList, search, statusFilter]);

  async function handleConfirmDelete(): Promise<void> {
    if (!pageToDelete) return;
    const id = pageToDelete;
    startTransition(async () => {
      const res = await deletePage(id);
      if (res.success) {
        setPagesList((prev) => prev.filter((p) => p.id !== id));
        toast.success(tc("deleted"));
      } else {
        toast.error(res.error || tc("confirmDelete"));
      }
      setPageToDelete(null);
    });
  }

  const statusOptions = [
    { key: "all", label: tc("all"), count: pagesList.length },
    { key: POST_STATUS.PUBLISHED, label: t("statusPublished"), count: pagesList.filter((p) => p.status === POST_STATUS.PUBLISHED).length },
    { key: POST_STATUS.SCHEDULED, label: t("statusScheduled"), count: pagesList.filter((p) => p.status === POST_STATUS.SCHEDULED).length },
    { key: POST_STATUS.DRAFT, label: t("statusDraft"), count: pagesList.filter((p) => p.status === POST_STATUS.DRAFT).length },
    { key: POST_STATUS.ARCHIVED, label: t("statusArchived"), count: pagesList.filter((p) => p.status === POST_STATUS.ARCHIVED).length },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={tc("pages")}
        subtitle={t("pagesDesc")}
        icon={<Files className="w-5 h-5" />}
        actions={
          <Link href="/admin/pages/new">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{t("createPage")}</span>
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        <Tabs items={statusOptions} activeKey={statusFilter} onSelect={setStatusFilter} variant="pills" />

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc("search")}
            className="w-full pl-8.5 pr-3 py-1.5 bg-input border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <AdminDataTable
        columns={[
          { key: "title", label: tc("title") },
          { key: "status", label: tc("status"), className: "hidden sm:table-cell" },
          { key: "language", label: tc("language"), className: "hidden md:table-cell" },
          { key: "views", label: tc("views"), className: "hidden sm:table-cell" },
          { key: "date", label: tc("date"), className: "hidden md:table-cell" },
          { key: "actions", label: tc("actions"), className: "text-right" },
        ]}
        isEmpty={filteredPages.length === 0}
        emptyIcon={<Files className="w-8 h-8" />}
        emptyTitle={tc("pages")}
        emptyDescription={t("noPagesFound")}
      >
        {filteredPages.map((page) => (
          <tr key={page.id} className="hover:bg-surface-hover/50 transition-colors group">
            <td className="py-3 px-4 max-w-xs">
              <Link href={`/admin/pages/${page.id}`} className="font-semibold text-text hover:text-accent transition-colors block truncate">
                {page.title}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-muted font-mono">
                <span>/p/{page.slug}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-1.5 sm:hidden flex-wrap">
                <StatusBadge status={page.status} className="text-[9px] py-0 px-1.5" />
                <span className="uppercase text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border/50 font-mono">
                  {page.locale}
                </span>
                <span className="text-[10px] text-text-muted flex items-center gap-0.5 font-mono">
                  <Eye className="w-2.5 h-2.5" /> {page.views.toLocaleString()}
                </span>
                <span className="text-[10px] text-text-muted">{page.publishedAtFormatted || page.createdAtFormatted}</span>
              </div>
            </td>

            <td className="py-3 px-4 hidden sm:table-cell">
              <StatusBadge status={page.status} />
            </td>

            <td className="py-3 px-4 hidden md:table-cell">
              <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border/50 font-mono">
                {page.locale}
              </span>
            </td>

            <td className="py-3 px-4 text-text-muted hidden sm:table-cell">
              <span className="flex items-center gap-1 font-mono">
                <Eye className="w-3.5 h-3.5" />
                {page.views.toLocaleString()}
              </span>
            </td>

            <td className="py-3 px-4 text-text-muted whitespace-nowrap hidden md:table-cell">
              {page.publishedAtFormatted || page.createdAtFormatted}
            </td>

            <td className="py-3 px-4 text-right">
              <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                {page.status === POST_STATUS.PUBLISHED && (
                  <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 sm:p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={tc("preview")}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <Link href={`/admin/pages/${page.id}`} className="p-2 sm:p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center" title={tc("edit")}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Link>
                <button type="button" onClick={() => setPageToDelete(page.id)} className="p-2 sm:p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center cursor-pointer" title={tc("delete")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>

      <ConfirmModal
        isOpen={Boolean(pageToDelete)}
        title={tc("delete")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setPageToDelete(null)}
      />
    </div>
  );
}
