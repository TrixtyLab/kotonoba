"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { NavItemFormModal } from "@/components/admin/NavItemFormModal";
import { NavLinksList } from "@/components/admin/NavLinksList";
import { NavAlignmentControl } from "@/components/admin/NavAlignmentControl";
import {
  buildNavItemEntry,
  parseInitialNavItems,
  type NavItemConfig,
} from "@/components/admin/nav-helpers";
import { Plus } from "lucide-react";

export type { NavItemConfig };

/** Configuration properties for the NavigationManager component. */
export interface NavigationManagerProps {
  /** Serialized JSON string of navigation link items. */
  initialLinks?: string | null;
  /** Initial horizontal alignment preference. */
  initialAlignment?: "left" | "center" | "right" | null;
  /** Catalog of published custom pages available for direct navigation linking. */
  availablePages?: Array<{ id: string; title: string; slug: string; locale?: string }>;
  /** Persistence callback fired when changes are saved. */
  onSave: (navLinks: string, navAlignment: "left" | "center" | "right") => Promise<boolean>;
}

/**
 * Interactive navigation builder allowing administrators to construct, reorder, localize, and configure menu items.
 */
export function NavigationManager({
  initialLinks,
  initialAlignment = "left",
  availablePages = [],
  onSave,
}: NavigationManagerProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const [alignment, setAlignment] = useState<"left" | "center" | "right">(initialAlignment || "left");
  const [items, setItems] = useState<NavItemConfig[]>(() =>
    parseInitialNavItems(initialLinks, tc("home").toUpperCase())
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState<"custom" | "page" | "social">("custom");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [itemLabelEs, setItemLabelEs] = useState("");
  const [itemLabelEn, setItemLabelEn] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemIcon, setItemIcon] = useState("none");
  const [itemTarget, setItemTarget] = useState<"_self" | "_blank">("_self");
  const [itemIsSocial, setItemIsSocial] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setLinkMode("custom");
    setSelectedPageId("");
    setItemLabelEs("");
    setItemLabelEn("");
    setItemUrl("");
    setItemIcon("none");
    setItemTarget("_self");
    setItemIsSocial(false);
    setIsEditing(true);
  }

  function openEditModal(item: NavItemConfig) {
    setEditingId(item.id);
    const isSocial = Boolean(item.isSocial);
    setItemIsSocial(isSocial);

    if (isSocial) {
      setLinkMode("social");
      setSelectedPageId("");
      setItemLabelEs("");
      setItemLabelEn("");
    } else {
      const foundPage = availablePages.find((p) => item.url === `/p/${p.slug}`);
      setLinkMode(foundPage ? "page" : "custom");
      setSelectedPageId(foundPage ? foundPage.id : "");
      setItemLabelEs(item.labels?.es || item.label_es || (item.isFixed ? tc("home") : item.label));
      setItemLabelEn(item.labels?.en || item.label_en || (item.isFixed ? "Home" : item.label));
    }

    setItemUrl(item.url);
    setItemIcon(item.icon || "none");
    setItemTarget(item.target || (isSocial ? "_blank" : "_self"));
    setIsEditing(true);
  }

  async function persistChanges(
    newItems: NavItemConfig[],
    newAlignment: "left" | "center" | "right" = alignment
  ): Promise<boolean> {
    setIsSaving(true);
    try {
      const success = await onSave(JSON.stringify(newItems), newAlignment);
      if (success) {
        setItems(newItems);
        return true;
      }
      return false;
    } catch {
      toast.error(t("saveError"));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAlignmentChange(newAlign: "left" | "center" | "right") {
    setAlignment(newAlign);
    await persistChanges(items, newAlign);
  }

  async function handleSaveItem() {
    const existingItem = editingId ? items.find((i) => i.id === editingId) : undefined;
    if (!existingItem?.isFixed && !itemUrl.trim()) {
      toast.error(t("navUrl"));
      return;
    }

    const selectedPage = availablePages.find(
      (pg) => pg.id === selectedPageId || itemUrl === `/p/${pg.slug}`
    );
    const built = buildNavItemEntry(
      {
        editingId,
        linkMode,
        selectedPage,
        itemIsSocial,
        itemIcon,
        itemUrl,
        itemTarget,
        itemLabelEs,
        itemLabelEn,
      },
      existingItem
    );

    if ("errorKey" in built) {
      toast.error(t(built.errorKey));
      return;
    }

    const newItems = editingId
      ? items.map((item) => (item.id === editingId ? built : item))
      : [...items, built];

    if (await persistChanges(newItems)) {
      setIsEditing(false);
    }
  }

  async function moveItem(index: number, direction: "up" | "down") {
    if (index === 0 && direction === "up") return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    await persistChanges(newItems);
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    const newItems = items.filter((item) => item.id !== deleteTargetId);
    setDeleteTargetId(null);
    await persistChanges(newItems);
  }

  return (
    <div className="space-y-6">
      <NavAlignmentControl
        alignment={alignment}
        onChangeAlignment={handleAlignmentChange}
      />

      <div className="bg-surface-hover/30 border border-border rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-text">
              {t("navigation")} ({items.length})
            </h3>
            <p className="text-xs text-text-muted mt-0.5">{t("navigationDesc")}</p>
          </div>

          <Button variant="primary" size="sm" onClick={openAddModal} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t("addNavLink")}
          </Button>
        </div>

        <NavLinksList
          items={items}
          onMoveItem={moveItem}
          onEditItem={openEditModal}
          onDeleteItem={setDeleteTargetId}
        />
      </div>

      <NavItemFormModal
        isOpen={isEditing}
        isEditingExisting={Boolean(editingId)}
        isEditingFixed={Boolean(editingId && items.find((i) => i.id === editingId)?.isFixed)}
        isSaving={isSaving}
        linkMode={linkMode}
        onChangeLinkMode={setLinkMode}
        availablePages={availablePages}
        selectedPageId={selectedPageId}
        onChangeSelectedPageId={setSelectedPageId}
        itemLabelEs={itemLabelEs}
        onChangeItemLabelEs={setItemLabelEs}
        itemLabelEn={itemLabelEn}
        onChangeItemLabelEn={setItemLabelEn}
        itemUrl={itemUrl}
        onChangeItemUrl={setItemUrl}
        itemIcon={itemIcon}
        onChangeItemIcon={setItemIcon}
        itemTarget={itemTarget}
        onChangeItemTarget={setItemTarget}
        itemIsSocial={itemIsSocial}
        onChangeItemIsSocial={setItemIsSocial}
        onClose={() => setIsEditing(false)}
        onSave={handleSaveItem}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title={tc("delete")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        variant="danger"
        isLoading={isSaving}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
