"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { NavItemFormModal } from "@/components/admin/NavItemFormModal";
import { NavLinksList } from "@/components/admin/NavLinksList";
import { AVAILABLE_NAV_ICONS } from "@/components/blog/NavIcon";
import { Plus, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

/**
 * Configuration structure for a custom navigation link item.
 */
export interface NavItemConfig {
  /** Unique item identifier. */
  id: string;
  /** Primary label fallback string. */
  label: string;
  /** Spanish label string. */
  label_es?: string;
  /** English label string. */
  label_en?: string;
  /** Multilingual dictionary of labels. */
  labels?: Record<string, string>;
  /** Destination route path or external URL. */
  url: string;
  /** Lucide icon identifier string. */
  icon?: string;
  /** Window target attribute (_self or _blank). */
  target?: "_self" | "_blank";
  /** Flag preventing deletion/modification of the core Home link. */
  isFixed?: boolean;
  /** Flag distinguishing social media icon links from standard text links. */
  isSocial?: boolean;
}

/**
 * Configuration properties for the NavigationManager component.
 */
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
 *
 * @param {NavigationManagerProps} props - Configuration options including initial links and persistence handler.
 * @returns {React.JSX.Element} React JSX navigation builder editor.
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

  const [items, setItems] = useState<NavItemConfig[]>(() => {
    if (initialLinks) {
      try {
        const parsed = JSON.parse(initialLinks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee Home is fixed
          const nonHome = parsed
            .filter((i) => i.id !== "home" && i.url !== "/" && !i.isFixed)
            .map((i) => {
              if (i.isSocial) {
                const rest = { ...i };
                delete rest.label_es;
                delete rest.label_en;
                delete rest.labels;
                return rest;
              }
              return i;
            });
          return [
            { id: "home", label: tc("home").toUpperCase(), url: "/", isFixed: true },
            ...nonHome,
          ];
        }
      } catch {
        // Fall back to default
      }
    }
    return [
      { id: "home", label: tc("home").toUpperCase(), url: "/", isFixed: true },
    ];
  });

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
      if (foundPage) {
        setLinkMode("page");
        setSelectedPageId(foundPage.id);
      } else {
        setLinkMode("custom");
        setSelectedPageId("");
      }

      const es = item.labels?.es || item.label_es || (item.isFixed ? tc("home") : item.label);
      const en = item.labels?.en || item.label_en || (item.isFixed ? "Home" : item.label);
      setItemLabelEs(es);
      setItemLabelEn(en);
    }

    setItemUrl(item.url);
    setItemIcon(item.icon || "none");
    setItemTarget(item.target || (isSocial ? "_blank" : "_self"));
    setIsEditing(true);
  }

  async function persistChanges(newItems: NavItemConfig[], newAlignment: "left" | "center" | "right" = alignment): Promise<boolean> {
    setIsSaving(true);
    try {
      const jsonString = JSON.stringify(newItems);
      const success = await onSave(jsonString, newAlignment);
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
    const isEditingFixed = Boolean(editingId && items.find((i) => i.id === editingId)?.isFixed);

    if (!isEditingFixed && !itemUrl.trim()) {
      toast.error(t("navUrl"));
      return;
    }

    let newItems: NavItemConfig[];

    if (linkMode === "page") {
      const selectedPage = availablePages.find(
        (pg) => pg.id === selectedPageId || itemUrl === `/p/${pg.slug}`
      );
      if (!selectedPage) {
        toast.error(t("choosePage"));
        return;
      }

      const pageTitle = selectedPage.title;
      const pageUrl = `/p/${selectedPage.slug}`;
      const labelsObj = {
        es: pageTitle,
        en: pageTitle,
      };

      if (editingId) {
        newItems = items.map((item) =>
          item.id === editingId
            ? {
                id: item.id,
                label: pageTitle,
                label_es: pageTitle,
                label_en: pageTitle,
                labels: labelsObj,
                url: pageUrl,
                icon: undefined,
                target: "_self",
                isSocial: false,
              }
            : item
        );
      } else {
        const newItem: NavItemConfig = {
          id: `custom_${Date.now()}`,
          label: pageTitle,
          label_es: pageTitle,
          label_en: pageTitle,
          labels: labelsObj,
          url: pageUrl,
          icon: undefined,
          target: "_self",
          isSocial: false,
        };
        newItems = [...items, newItem];
      }
    } else if (itemIsSocial) {
      const selectedIconObj = AVAILABLE_NAV_ICONS.find((ico) => ico.id === itemIcon);
      const socialLabel = selectedIconObj?.label || (itemIcon !== "none" ? itemIcon : "Social");

      if (editingId) {
        newItems = items.map((item) =>
          item.id === editingId
            ? {
                id: item.id,
                label: socialLabel,
                url: item.isFixed ? item.url : itemUrl.trim(),
                icon: itemIcon === "none" ? "link" : itemIcon,
                target: item.isFixed ? "_self" : itemTarget,
                isSocial: true,
              }
            : item
        );
      } else {
        const newItem: NavItemConfig = {
          id: `custom_${Date.now()}`,
          label: socialLabel,
          url: itemUrl.trim(),
          icon: itemIcon === "none" ? "link" : itemIcon,
          target: itemTarget,
          isSocial: true,
        };
        newItems = [...items, newItem];
      }
    } else {
      const mainLabel = itemLabelEs.trim() || itemLabelEn.trim();
      if (!mainLabel) {
        toast.error(t("navLabel"));
        return;
      }

      const labelsObj = {
        es: itemLabelEs.trim() || mainLabel,
        en: itemLabelEn.trim() || mainLabel,
      };

      if (editingId) {
        newItems = items.map((item) =>
          item.id === editingId
            ? {
                id: item.id,
                label: mainLabel,
                label_es: labelsObj.es,
                label_en: labelsObj.en,
                labels: labelsObj,
                url: item.isFixed ? item.url : itemUrl.trim(),
                icon: undefined,
                target: item.isFixed ? "_self" : itemTarget,
                isSocial: false,
              }
            : item
        );
      } else {
        const newItem: NavItemConfig = {
          id: `custom_${Date.now()}`,
          label: mainLabel,
          label_es: labelsObj.es,
          label_en: labelsObj.en,
          labels: labelsObj,
          url: itemUrl.trim(),
          icon: undefined,
          target: itemTarget,
          isSocial: false,
        };
        newItems = [...items, newItem];
      }
    }

    const ok = await persistChanges(newItems);
    if (ok) {
      setIsEditing(false);
    }
  }

  async function moveItem(index: number, direction: "up" | "down") {
    if (index === 0 && direction === "up") return; // Home is fixed
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= items.length) return; // Keep Home at index 0

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    await persistChanges(newItems);
  }

  function handleDelete(id: string) {
    setDeleteTargetId(id);
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    const newItems = items.filter((item) => item.id !== deleteTargetId);
    setDeleteTargetId(null);
    await persistChanges(newItems);
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-hover/30 border border-border rounded-xl p-5 space-y-3.5 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-text">
            {t("navAlignment")}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {t("navigationDesc")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-sm pt-1">
          <button
            type="button"
            onClick={() => handleAlignmentChange("left")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              alignment === "left"
                ? "border-accent bg-accent/10 text-accent shadow-xs"
                : "border-border bg-surface hover:bg-surface-hover text-text-muted"
            }`}
          >
            <AlignLeft className="w-4 h-4" />
            <span>{t("alignLeft")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleAlignmentChange("center")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              alignment === "center"
                ? "border-accent bg-accent/10 text-accent shadow-xs"
                : "border-border bg-surface hover:bg-surface-hover text-text-muted"
            }`}
          >
            <AlignCenter className="w-4 h-4" />
            <span>{t("alignCenter")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleAlignmentChange("right")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
              alignment === "right"
                ? "border-accent bg-accent/10 text-accent shadow-xs"
                : "border-border bg-surface hover:bg-surface-hover text-text-muted"
            }`}
          >
            <AlignRight className="w-4 h-4" />
            <span>{t("alignRight")}</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-hover/30 border border-border rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-text">
              {t("navigation")} ({items.length})
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t("navigationDesc")}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t("addNavLink")}
          </Button>
        </div>

        <NavLinksList
          items={items}
          onMoveItem={moveItem}
          onEditItem={openEditModal}
          onDeleteItem={handleDelete}
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

      {/* Delete Modal */}
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
