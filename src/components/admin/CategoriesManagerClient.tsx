"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Edit3, Trash2, Folder, Search } from "lucide-react";

/**
 * Representation of a taxonomy category item.
 */
export interface CategoryItem {
  /** Database identifier of the category. */
  id: string;
  /** Category display name. */
  name: string;
  /** URL slug string. */
  slug: string;
  /** Optional descriptive explanation. */
  description?: string | null;
  /** Numerical sorting weight. */
  sortOrder: number;
}

/**
 * Category management interface allowing administrators to create, edit, reorder, and remove site taxonomy categories.
 *
 * @param props - Object containing the target siteId and initial CategoryItem array.
 * @returns React JSX category management interface.
 */
export function CategoriesManagerClient({
  siteId,
  initialCategories,
}: {
  siteId: string;
  initialCategories: CategoryItem[];
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const toast = useToast();
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function openCreateModal() {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setModalOpen(true);
  }

  function openEditModal(cat: CategoryItem) {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t("categoryNameRequired"));
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const res = await updateCategory(editingId, { name, slug, description });
        if (res.success) {
          setCategories((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, name, slug: slug || name.toLowerCase(), description } : c))
          );
          setModalOpen(false);
          toast.success(t("categoryUpdated"));
        } else {
          toast.error(tc("save"));
        }
      } else {
        const res = await createCategory(siteId, { name, slug, description });
        if (res.success && res.id) {
          setCategories((prev) => [
            ...prev,
            { id: res.id as string, name, slug: slug || name.toLowerCase(), description, sortOrder: 0 },
          ]);
          setModalOpen(false);
          toast.success(t("categoryCreated"));
        } else {
          toast.error(tc("save"));
        }
      }
    });
  }

  async function handleConfirmDelete() {
    if (!categoryToDelete) return;
    const id = categoryToDelete;
    startTransition(async () => {
      const res = await deleteCategory(id);
      if (res.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success(t("categoryDeleted"));
      } else {
        toast.error(tc("delete"));
      }
      setCategoryToDelete(null);
    });
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{tc("categories")}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("categoriesSubtitle")}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus className="w-3.5 h-3.5" />}>
          {t("newCategory")}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-surface border border-border rounded-xl p-3 shadow-xs">
        <div className="relative max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={tc("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-hover/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-muted/50 focus:outline-hidden focus:border-accent"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => (
          <div
            key={cat.id}
            className="p-4 rounded-xl bg-surface border border-border hover:border-border-hover transition-all shadow-xs flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-accent font-semibold text-xs">
                <Folder className="w-4 h-4" />
                <h3 className="text-sm font-bold text-text truncate">{cat.name}</h3>
              </div>
              <p className="text-[11px] font-mono text-text-muted">/category/{cat.slug}</p>
              {cat.description && <p className="text-xs text-text-muted line-clamp-2">{cat.description}</p>}
            </div>

            <div className="flex items-center justify-end gap-1 pt-2.5 border-t border-border">
              <button
                type="button"
                onClick={() => openEditModal(cat)}
                className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                title={tc("edit")}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCategoryToDelete(cat.id)}
                className="p-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
                title={tc("delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-10 text-center rounded-xl bg-surface border border-border text-xs text-text-muted space-y-1">
          <Folder className="w-6 h-6 opacity-30 mx-auto" />
          <p>{t("noCategories")}</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t("editCategory") : t("newCategory")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 text-xs"
        >
          <Input
            label={t("categoryName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("categoryNamePlaceholder")}
            required
            autoFocus
          />

          <Input
            label={t("categorySlugOptional")}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t("categorySlugPlaceholder")}
          />

          <Textarea
            label={t("categoryDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("categoryDescPlaceholder")}
            className="min-h-[80px]"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={isPending}>
              {editingId ? t("saveChanges") : t("createCategory")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t("deleteCategory")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
