"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Plus, Edit3, Trash2, Folder } from "lucide-react";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
}

/**
 * Category management client component providing live CRUD modals and listing.
 */
export function CategoriesManagerClient({
  siteId,
  initialCategories,
}: {
  siteId: string;
  initialCategories: CategoryItem[];
}) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [categories, setCategories] = useState(initialCategories);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    if (!name.trim()) return;

    startTransition(async () => {
      if (editingId) {
        const res = await updateCategory(editingId, { name, slug, description });
        if (res.success) {
          setCategories((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, name, slug: slug || name.toLowerCase(), description } : c))
          );
          setModalOpen(false);
        }
      } else {
        const res = await createCategory(siteId, { name, slug, description });
        if (res.success && res.id) {
          setCategories((prev) => [
            ...prev,
            { id: res.id as string, name, slug: slug || name.toLowerCase(), description, sortOrder: 0 },
          ]);
          setModalOpen(false);
        }
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm(tCommon("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteCategory(id);
      if (res.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">{tCommon("categories")}</h1>
          <p className="text-xs text-text-muted">{t("categoriesSubtitle")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          {t("newCategory")}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="glass p-5 rounded-xl border border-border flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Folder className="w-4 h-4" />
                <h3 className="text-base font-bold text-text truncate">{cat.name}</h3>
              </div>
              <p className="text-xs font-mono text-text-muted">/category/{cat.slug}</p>
              {cat.description && <p className="text-xs text-text-muted line-clamp-2">{cat.description}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <button
                onClick={() => openEditModal(cat)}
                className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                title={t("editCategory")}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                title={t("deleteCategory")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="p-12 text-center glass rounded-xl border border-border text-sm text-text-muted">
          {t("noCategories")}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t("editCategory") : t("newCategory")}
      >
        <div className="space-y-4">
          <Input
            label={t("categoryName")}
            placeholder={t("categoryNamePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!editingId) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
              }
            }}
          />
          <Input
            label={t("categorySlugOptional")}
            placeholder={t("categorySlugPlaceholder")}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Textarea
            label={t("categoryDescription")}
            placeholder={t("categoryDescPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>
              {editingId ? t("saveChanges") : t("createCategory")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
