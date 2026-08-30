"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { deletePage } from "@/actions/pages";
import { Search, Eye, Edit3, Trash2, ExternalLink, Plus, Files } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

/**
 * Summary representation of a page displayed in the administrative pages table.
 */
export interface PageItem {
  /** Database identifier of the page. */
  id: string;
  /** Page title. */
  title: string;
  /** URL slug string. */
  slug: string;
  /** Publication lifecycle status. */
  status: "draft" | "published" | "scheduled" | "archived";
  /** Language locale code. */
  locale: string;
  /** View count metric. */
  views: number;
  /** Formatted publication timestamp. */
  publishedAtFormatted?: string | null;
  /** Formatted creation timestamp. */
  createdAtFormatted: string;
  /** Author display name. */
  authorName?: string | null;
}

/**
 * Administrative custom pages management table with search, status filters, and deletion.
 *
 * @param {Object} props - Component properties.
 * @param {PageItem[]} props.initialPages - Initial catalog of PageItem records loaded from the server.
 * @returns {React.JSX.Element} React JSX pages list view.
 */
export function PagesListClient({ initialPages }: { initialPages: PageItem[] }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const toast = useToast();
  const [pagesList, setPagesList] = useState(initialPages);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPages = useMemo(() => {
    return pagesList.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pagesList, search, statusFilter]);

  async function handleConfirmDelete() {
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
    { key: "published", label: t("statusPublished"), count: pagesList.filter((p) => p.status === "published").length },
    { key: "scheduled", label: t("statusScheduled"), count: pagesList.filter((p) => p.status === "scheduled").length },
    { key: "draft", label: t("statusDraft"), count: pagesList.filter((p) => p.status === "draft").length },
    { key: "archived", label: t("statusArchived"), count: pagesList.filter((p) => p.status === "archived").length },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Files className="w-5 h-5 text-accent" />
            <span>{tc("pages")}</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {t("pagesDesc")}
          </p>
        </div>

        <Link href="/admin/pages/new">
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>{t("createPage")}</span>
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {statusOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setStatusFilter(opt.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                statusFilter === opt.key
                  ? "bg-accent text-white font-semibold shadow-2xs"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              <span>{opt.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === opt.key ? "bg-white/20 text-white" : "bg-surface-hover text-text-muted"
                }`}
              >
                {opt.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
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

      {/* Pages Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-hover/30 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">{tc("title")}</th>
                <th className="py-3 px-4">{tc("status")}</th>
                <th className="py-3 px-4">{tc("language")}</th>
                <th className="py-3 px-4">{tc("views")}</th>
                <th className="py-3 px-4">{tc("date")}</th>
                <th className="py-3 px-4 text-right">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <Files className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-text">{tc("pages")}</p>
                    <p className="text-[11px] mt-0.5">{t("noPagesFound")}</p>
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-surface-hover/50 transition-colors group">
                    <td className="py-3 px-4 max-w-xs">
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="font-semibold text-text hover:text-accent transition-colors block truncate"
                      >
                        {page.title}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-muted font-mono">
                        <span>/p/{page.slug}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          page.status === "published"
                            ? "success"
                            : page.status === "scheduled"
                            ? "primary"
                            : page.status === "archived"
                            ? "secondary"
                            : "warning"
                        }
                      >
                        {page.status === "published"
                          ? t("statusPublished")
                          : page.status === "scheduled"
                          ? t("statusScheduled")
                          : page.status === "archived"
                          ? t("statusArchived")
                          : t("statusDraft")}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border/50">
                        {page.locale}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-text-muted">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {page.views.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                      {page.publishedAtFormatted || page.createdAtFormatted}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                        {page.status === "published" && (
                          <a
                            href={`/p/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                            title={tc("preview")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <Link
                          href={`/admin/pages/${page.id}`}
                          className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                          title={tc("edit")}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => setPageToDelete(page.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                          title={tc("delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Delete Dialog */}
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
