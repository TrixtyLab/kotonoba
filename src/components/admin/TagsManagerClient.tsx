"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createTag, deleteTag } from "@/actions/tags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { Tag as TagIcon, Plus, Search } from "lucide-react";

/**
 * Representation of a taxonomy tag item.
 */
export interface TagItem {
  /** Database identifier of the tag. */
  id: string;
  /** Tag display label. */
  name: string;
  /** URL slug string. */
  slug: string;
}

/**
 * Tag management interface allowing administrators to view, create, search, and delete blog tags.
 *
 * @param props - Object containing the target siteId and initial TagItem array.
 * @returns React JSX tag management interface.
 */
export function TagsManagerClient({
  siteId,
  initialTags,
}: {
  siteId: string;
  initialTags: TagItem[];
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const toast = useToast();
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const res = await createTag(siteId, { name });
      if (res.success && res.id) {
        setTags((prev) => [...prev, { id: res.id as string, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }]);
        setName("");
        toast.success(t("tagCreated"));
      } else {
        toast.error(tc("save"));
      }
    });
  }

  async function handleConfirmDelete() {
    if (!tagToDelete) return;
    const id = tagToDelete;
    startTransition(async () => {
      const res = await deleteTag(id);
      if (res.success) {
        setTags((prev) => prev.filter((t) => t.id !== id));
        toast.success(t("tagDeleted"));
      } else {
        toast.error(tc("delete"));
      }
      setTagToDelete(null);
    });
  }

  const filteredTags = tags.filter((tItem) =>
    tItem.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text tracking-tight">{tc("tags")}</h1>
        <p className="text-xs text-text-muted mt-0.5">
          {t("tagsSubtitle")}
        </p>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="p-4 rounded-xl bg-surface border border-border shadow-xs flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <Input
            label={t("newTag")}
            placeholder={t("tagPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" size="sm" loading={isPending} icon={<Plus className="w-3.5 h-3.5" />} className="w-full sm:w-auto">
          {tc("create")}
        </Button>
      </form>

      {/* Catalog */}
      <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text">
            {t("allTags")} ({tags.length})
          </h2>

          <div className="relative max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs rounded-lg border border-border bg-surface-hover/30 text-text focus:outline-hidden focus:border-accent font-medium"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {filteredTags.map((tItem) => (
            <div
              key={tItem.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover/60 border border-border text-xs font-medium text-text group hover:border-accent transition-colors shadow-2xs"
            >
              <TagIcon className="w-3.5 h-3.5 text-accent" />
              <span>#{tItem.name}</span>
              <button
                type="button"
                onClick={() => setTagToDelete(tItem.id)}
                className="text-text-muted hover:text-rose-500 ml-1 p-0.5 rounded transition-colors"
                title={tc("delete")}
              >
                ✕
              </button>
            </div>
          ))}

          {filteredTags.length === 0 && (
            <p className="text-xs text-text-muted py-6 text-center w-full">
              {t("noTags")}
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(tagToDelete)}
        onClose={() => setTagToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t("deleteTag")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
