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
  Files,
  Link2,
  Globe,
  Home,
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
                const { label_es, label_en, labels, ...rest } = i;
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
                  {item.isSocial ? (
                    <NavIcon name={item.icon || "link"} className="w-3.5 h-3.5" />
                  ) : item.isFixed ? (
                    <Home className="w-3.5 h-3.5 text-accent" />
                  ) : item.url.startsWith("/p/") ? (
                    <Files className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
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
                    ) : !item.isSocial && item.labels ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-hover text-text-muted flex items-center gap-1">
                        <Languages className="w-2.5 h-2.5" />
                        <span>ES: {item.labels.es || item.label} / EN: {item.labels.en || item.label}</span>
                      </span>
                    ) : null}
                    {item.isSocial ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                        {t("navSocialBadge")}
                      </span>
                    ) : !item.isFixed && item.url.startsWith("/p/") ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        {t("navPageBadge")}
                      </span>
                    ) : !item.isFixed && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                        {t("navLinkBadge")}
                      </span>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(item)}
                  className="text-xs p-1.5 h-8 w-8 text-text-muted hover:text-text"
                  title={tc("edit")}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                {!item.isFixed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs p-1.5 h-8 w-8 text-text-muted hover:text-danger"
                    title={tc("delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-text">
              {editingId ? tc("edit") : tc("add")}
            </h4>

            <div className="space-y-3.5 text-xs">
              {/* Type Switcher Segmented Control */}
              {(!editingId || !items.find((i) => i.id === editingId)?.isFixed) && (
                <div className="grid grid-cols-3 gap-1 p-1 bg-surface-hover/60 border border-border rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkMode("custom");
                      setItemIsSocial(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      linkMode === "custom"
                        ? "bg-surface text-blue-400 shadow-xs border border-border/80 font-bold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span className="truncate">{t("linkTypeCustom")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkMode("page");
                      setItemIsSocial(false);
                      if (availablePages.length > 0 && !selectedPageId) {
                        const firstPage = availablePages[0];
                        setSelectedPageId(firstPage.id);
                        setItemUrl(`/p/${firstPage.slug}`);
                        if (!itemLabelEs) setItemLabelEs(firstPage.title);
                        if (!itemLabelEn) setItemLabelEn(firstPage.title);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      linkMode === "page"
                        ? "bg-surface text-emerald-400 shadow-xs border border-border/80 font-bold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    <Files className="w-3.5 h-3.5" />
                    <span className="truncate">{t("linkTypePage")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkMode("social");
                      setItemIsSocial(true);
                      setItemLabelEs("");
                      setItemLabelEn("");
                      if (itemTarget === "_self") setItemTarget("_blank");
                      if (itemIcon === "none") setItemIcon("twitter");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      linkMode === "social"
                        ? "bg-surface text-purple-400 shadow-xs border border-border/80 font-bold"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="truncate">{t("linkTypeSocial")}</span>
                  </button>
                </div>
              )}

              {/* Page Selector (When Page mode is active) */}
              {linkMode === "page" && !itemIsSocial && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-text">{t("selectPage")}</label>
                  {availablePages.length > 0 ? (
                    <select
                      value={selectedPageId}
                      onChange={(e) => {
                        const pageId = e.target.value;
                        setSelectedPageId(pageId);
                        const p = availablePages.find((pg) => pg.id === pageId);
                        if (p) {
                          setItemUrl(`/p/${p.slug}`);
                          setItemLabelEs(p.title);
                          setItemLabelEn(p.title);
                        }
                      }}
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-xs text-text focus:outline-hidden focus:border-accent"
                    >
                      <option value="">{t("choosePage")}</option>
                      {availablePages.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.title} (/p/{pg.slug})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-text-muted bg-surface-hover/40 p-2.5 rounded-lg border border-border">
                      {t("noPagesAvailable")}
                    </p>
                  )}

                  {selectedPageId && itemUrl && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted bg-surface-hover/50 px-2.5 py-1.5 rounded-lg border border-border/60">
                      <span className="text-emerald-400 font-semibold">URL:</span>
                      <span>{itemUrl}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Text Label Inputs (Only for manual custom links) */}
              {linkMode === "custom" && !itemIsSocial && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t("navLabelEs")}
                    value={itemLabelEs}
                    onChange={(e) => setItemLabelEs(e.target.value)}
                    placeholder={t("navLabelEsPlaceholder")}
                    autoFocus
                  />
                  <Input
                    label={t("navLabelEn")}
                    value={itemLabelEn}
                    onChange={(e) => setItemLabelEn(e.target.value)}
                    placeholder={t("navLabelEnPlaceholder")}
                  />
                </div>
              )}

              {itemIsSocial && (
                <div className="p-2.5 rounded-lg bg-surface-hover/40 border border-border/70 flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {t("navSocialBadge")}:
                  </span>
                  <span className="font-semibold text-accent flex items-center gap-1.5">
                    {itemIcon !== "none" && <NavIcon name={itemIcon} className="w-3.5 h-3.5" />}
                    <span>{AVAILABLE_NAV_ICONS.find((i) => i.id === itemIcon)?.label || (itemIcon !== "none" ? itemIcon : t("navNoIcon"))}</span>
                  </span>
                </div>
              )}

              {/* Destination URL Input (Only for manual links and social links, never for custom pages) */}
              {linkMode !== "page" && (!editingId || !items.find((i) => i.id === editingId)?.isFixed) && (
                <Input
                  label={t("navUrl")}
                  value={itemUrl}
                  onChange={(e) => setItemUrl(e.target.value)}
                  placeholder={
                    itemIsSocial
                      ? t("navSocialUrlPlaceholder")
                      : t("navUrlPlaceholder")
                  }
                  autoFocus={itemIsSocial}
                />
              )}

              {itemIsSocial && (
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    {t("navIcon")} *
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-surface-hover/30">
                    {AVAILABLE_NAV_ICONS.map((ico) => (
                      <button
                        key={ico.id}
                        type="button"
                        onClick={() => setItemIcon(ico.id)}
                        className={`p-1.5 rounded-md border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
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
              )}

              {linkMode !== "page" && (!editingId || !items.find((i) => i.id === editingId)?.isFixed) && (
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
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                {tc("cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveItem} loading={isSaving} disabled={isSaving}>
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
        isLoading={isSaving}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
