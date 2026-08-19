"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { NavIcon, AVAILABLE_NAV_ICONS } from "@/components/blog/NavIcon";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Edit2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ExternalLink,
  Languages,
} from "lucide-react";

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
  /** Link target attribute. */
  target?: "_self" | "_blank";
  /** Flag denoting whether the item is fixed in position. */
  isFixed?: boolean;
}

/**
 * Configuration properties for the NavigationManager component.
 */
export interface NavigationManagerProps {
  /** Serialized JSON string of navigation link items. */
  initialLinks?: string | null;
  /** Initial horizontal alignment preference. */
  initialAlignment?: "left" | "center" | "right" | null;
  /** Persistence callback fired when changes are saved. */
  onSave: (navLinks: string, navAlignment: "left" | "center" | "right") => Promise<boolean>;
}

/**
 * Interactive navigation builder allowing administrators to construct, reorder, localize, and configure menu items.
 *
 * @param props - NavigationManagerProps configuring initial link collections and save handler.
 * @returns React JSX navigation builder editor.
 */
export function NavigationManager({
  initialLinks,
  initialAlignment = "left",
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
          const nonHome = parsed.filter((i) => i.id !== "home" && i.url !== "/" && !i.isFixed);
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
  const [itemLabelEs, setItemLabelEs] = useState("");
  const [itemLabelEn, setItemLabelEn] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemIcon, setItemIcon] = useState("none");
  const [itemTarget, setItemTarget] = useState<"_self" | "_blank">("_self");

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function openAddModal() {
    setEditingId(null);
    setItemLabelEs("");
    setItemLabelEn("");
    setItemUrl("");
    setItemIcon("none");
    setItemTarget("_self");
    setIsEditing(true);
  }

  function openEditModal(item: NavItemConfig) {
    setEditingId(item.id);
    const es = item.labels?.es || item.label_es || (item.isFixed ? tc("home") : item.label);
    const en = item.labels?.en || item.label_en || (item.isFixed ? "Home" : item.label);
    setItemLabelEs(es);
    setItemLabelEn(en);
    setItemUrl(item.url);
    setItemIcon(item.icon || "none");
    setItemTarget(item.target || "_self");
    setIsEditing(true);
  }

  function handleSaveItem() {
    const mainLabel = itemLabelEs.trim() || itemLabelEn.trim();
    if (!mainLabel) {
      toast.error(t("navLabel"));
      return;
    }
    if (!editingId && !itemUrl.trim()) {
      toast.error(t("navUrl"));
      return;
    }

    const labelsObj = {
      es: itemLabelEs.trim() || itemLabelEn.trim(),
      en: itemLabelEn.trim() || itemLabelEs.trim(),
    };

    if (editingId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                label: mainLabel,
                label_es: labelsObj.es,
                label_en: labelsObj.en,
                labels: labelsObj,
                url: item.isFixed ? item.url : itemUrl.trim(),
                icon: itemIcon === "none" ? undefined : itemIcon,
                target: item.isFixed ? "_self" : itemTarget,
              }
            : item
        )
      );
    } else {
      const newItem: NavItemConfig = {
        id: `custom_${Date.now()}`,
        label: mainLabel,
        label_es: labelsObj.es,
        label_en: labelsObj.en,
        labels: labelsObj,
        url: itemUrl.trim(),
        icon: itemIcon === "none" ? undefined : itemIcon,
        target: itemTarget,
      };
      setItems((prev) => [...prev, newItem]);
    }

    setIsEditing(false);
  }

  function moveItem(index: number, direction: "up" | "down") {
    if (index === 0 && direction === "up") return; // Home is fixed
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= items.length) return; // Keep Home at index 0

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
  }

  function handleDelete(id: string) {
    setDeleteTargetId(id);
  }

  function confirmDelete() {
    if (!deleteTargetId) return;
    setItems((prev) => prev.filter((item) => item.id !== deleteTargetId));
    setDeleteTargetId(null);
  }

  async function handleSaveAll() {
    setIsSaving(true);
    try {
      const jsonString = JSON.stringify(items);
      const success = await onSave(jsonString, alignment);
      if (success) {
        toast.success(t("saveSuccess"));
      } else {
        toast.error(t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Alignment Selector */}
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
            onClick={() => setAlignment("left")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
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
            onClick={() => setAlignment("center")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
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
            onClick={() => setAlignment("right")}
            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 text-xs font-semibold transition-all ${
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

      {/* 2. Navigation Items List */}
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

        {/* Links List */}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:border-border-hover transition-colors gap-3"
            >
              {/* Left: Reorder + Icon + Label + URL */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, "up")}
                    disabled={idx <= 1 || item.isFixed}
                    className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-20"
                    title={tc("previous")}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, "down")}
                    disabled={idx === items.length - 1 || item.isFixed}
                    className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-20"
                    title={tc("next")}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-accent shrink-0">
                  {item.icon ? (
                    <NavIcon name={item.icon} className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-[9px] text-text-muted font-bold">Aa</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-text truncate">
                      {item.isFixed ? tc("home").toUpperCase() : item.label}
                    </span>
                    {item.isFixed ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase">
                        {tc("home")} ({t("general")})
                      </span>
                    ) : (
                      item.labels && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-hover text-text-muted flex items-center gap-1">
                          <Languages className="w-2.5 h-2.5" />
                          <span>ES: {item.labels.es || item.label} / EN: {item.labels.en || item.label}</span>
                        </span>
                      )
                    )}
                    {item.target === "_blank" && (
                      <span className="text-[10px] text-text-muted flex items-center gap-0.5" title={t("navNewTab")}>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-muted font-mono truncate block">
                    {item.url}
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {!item.isFixed && (
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    title={tc("edit")}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {!item.isFixed && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title={tc("delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
          >
            {isSaving ? tc("saving") : t("saveNav")}
          </Button>
        </div>
      </div>

      {/* Modal: Add/Edit Link */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-xl p-5 shadow-xl space-y-4 animate-slide-up">
            <h4 className="text-sm font-bold text-text">
              {editingId ? tc("edit") : t("addNavLink")}
            </h4>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Texto en Español (ES)"
                  value={itemLabelEs}
                  onChange={(e) => setItemLabelEs(e.target.value)}
                  placeholder="ej. Tienda, Contacto"
                  autoFocus
                />
                <Input
                  label="Text in English (EN)"
                  value={itemLabelEn}
                  onChange={(e) => setItemLabelEn(e.target.value)}
                  placeholder="e.g. Shop, Contact"
                />
              </div>

              {(!editingId || !items.find((i) => i.id === editingId)?.isFixed) && (
                <Input
                  label={t("navUrl")}
                  value={itemUrl}
                  onChange={(e) => setItemUrl(e.target.value)}
                  placeholder="https://... o /archive"
                />
              )}

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  {t("navIcon")}
                </label>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-surface-hover/30">
                  <button
                    type="button"
                    onClick={() => setItemIcon("none")}
                    className={`p-1.5 rounded-md border text-center flex flex-col items-center gap-1 transition-all ${
                      itemIcon === "none"
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border/50 text-text-muted hover:text-text hover:bg-surface"
                    }`}
                  >
                    <span className="text-[10px]">Sin icono</span>
                  </button>
                  {AVAILABLE_NAV_ICONS.map((ico) => (
                    <button
                      key={ico.id}
                      type="button"
                      onClick={() => setItemIcon(ico.id)}
                      className={`p-1.5 rounded-md border text-center flex flex-col items-center gap-1 transition-all ${
                        itemIcon === ico.id
                          ? "border-accent bg-accent/10 text-accent font-semibold shadow-2xs"
                          : "border-border/50 text-text-muted hover:text-text hover:bg-surface"
                      }`}
                      title={ico.label}
                    >
                      <NavIcon name={ico.id} className="w-3.5 h-3.5" />
                      <span className="text-[9px] truncate max-w-full">{ico.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(!editingId || !items.find((i) => i.id === editingId)?.isFixed) && (
                <div className="pt-1">
                  <Checkbox
                    checked={itemTarget === "_blank"}
                    onChange={(checked) => setItemTarget(checked ? "_blank" : "_self")}
                    label={`${t("navNewTab")} (target='_blank')`}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                {tc("cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveItem}>
                {tc("save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title={tc("delete")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        variant="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
