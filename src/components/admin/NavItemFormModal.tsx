"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Files, Globe, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { NavIcon, AVAILABLE_NAV_ICONS } from "@/components/blog/NavIcon";

/** Available static page item eligible for navigation links. */
export interface NavAvailablePage {
  id: string;
  title: string;
  slug: string;
  locale?: string;
}

/** Props for {@link NavItemFormModal}. */
export interface NavItemFormModalProps {
  isOpen: boolean;
  isEditingExisting: boolean;
  isEditingFixed: boolean;
  isSaving: boolean;
  linkMode: "custom" | "page" | "social";
  onChangeLinkMode: (mode: "custom" | "page" | "social") => void;
  availablePages: NavAvailablePage[];
  selectedPageId: string;
  onChangeSelectedPageId: (pageId: string) => void;
  itemLabelEs: string;
  onChangeItemLabelEs: (value: string) => void;
  itemLabelEn: string;
  onChangeItemLabelEn: (value: string) => void;
  itemUrl: string;
  onChangeItemUrl: (value: string) => void;
  itemIcon: string;
  onChangeItemIcon: (value: string) => void;
  itemTarget: "_self" | "_blank";
  onChangeItemTarget: (value: "_self" | "_blank") => void;
  itemIsSocial: boolean;
  onChangeItemIsSocial: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
}

function NavModeTabs({
  linkMode,
  onSelectCustom,
  onSelectPage,
  onSelectSocial,
  t,
}: {
  linkMode: "custom" | "page" | "social";
  onSelectCustom: () => void;
  onSelectPage: () => void;
  onSelectSocial: () => void;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 bg-surface-hover/60 border border-border rounded-xl text-xs font-semibold">
      <button
        type="button"
        onClick={onSelectCustom}
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
        onClick={onSelectPage}
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
        onClick={onSelectSocial}
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
  );
}

function NavPageSelectSection({
  availablePages,
  selectedPageId,
  itemUrl,
  onSelectPageId,
  t,
}: {
  availablePages: Array<{ id: string; title: string; slug: string }>;
  selectedPageId: string;
  itemUrl: string;
  onSelectPageId: (pageId: string) => void;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-text">{t("selectPage")}</label>
      {availablePages.length > 0 ? (
        <select
          value={selectedPageId}
          onChange={(e) => onSelectPageId(e.target.value)}
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
  );
}

function NavSocialIconPicker({
  itemIcon,
  onChangeItemIcon,
  t,
}: {
  itemIcon: string;
  onChangeItemIcon: (icon: string) => void;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const iconLabel =
    AVAILABLE_NAV_ICONS.find((i) => i.id === itemIcon)?.label ||
    (itemIcon !== "none" ? itemIcon : t("navNoIcon"));

  return (
    <>
      <div className="p-2.5 rounded-lg bg-surface-hover/40 border border-border/70 flex items-center justify-between text-xs">
        <span className="text-text-muted">{t("navSocialBadge")}:</span>
        <span className="font-semibold text-accent flex items-center gap-1.5">
          {itemIcon !== "none" && <NavIcon name={itemIcon} className="w-3.5 h-3.5" />}
          <span>{iconLabel}</span>
        </span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text mb-1">{t("navIcon")} *</label>
        <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-surface-hover/30">
          {AVAILABLE_NAV_ICONS.map((ico) => (
            <button
              key={ico.id}
              type="button"
              onClick={() => onChangeItemIcon(ico.id)}
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
    </>
  );
}

/**
 * Modal form for creating or editing custom links, static page links, or social icon buttons in the blog navbar.
 */
export function NavItemFormModal({
  isOpen,
  isEditingExisting,
  isEditingFixed,
  isSaving,
  linkMode,
  onChangeLinkMode,
  availablePages,
  selectedPageId,
  onChangeSelectedPageId,
  itemLabelEs,
  onChangeItemLabelEs,
  itemLabelEn,
  onChangeItemLabelEn,
  itemUrl,
  onChangeItemUrl,
  itemIcon,
  onChangeItemIcon,
  itemTarget,
  onChangeItemTarget,
  itemIsSocial,
  onChangeItemIsSocial,
  onClose,
  onSave,
}: NavItemFormModalProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  if (!isOpen) return null;

  function selectPage(pageId: string) {
    onChangeSelectedPageId(pageId);
    const p = availablePages.find((pg) => pg.id === pageId);
    if (!p) return;
    onChangeItemUrl(`/p/${p.slug}`);
    onChangeItemLabelEs(p.title);
    onChangeItemLabelEn(p.title);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
        <h4 className="text-sm font-bold text-text">{isEditingExisting ? tc("edit") : tc("add")}</h4>

        <div className="space-y-3.5 text-xs">
          {!isEditingFixed && (
            <NavModeTabs
              linkMode={linkMode}
              onSelectCustom={() => {
                onChangeLinkMode("custom");
                onChangeItemIsSocial(false);
              }}
              onSelectPage={() => {
                onChangeLinkMode("page");
                onChangeItemIsSocial(false);
                if (availablePages.length > 0 && !selectedPageId) selectPage(availablePages[0].id);
              }}
              onSelectSocial={() => {
                onChangeLinkMode("social");
                onChangeItemIsSocial(true);
                onChangeItemLabelEs("");
                onChangeItemLabelEn("");
                if (itemTarget === "_self") onChangeItemTarget("_blank");
                if (itemIcon === "none") onChangeItemIcon("twitter");
              }}
              t={t}
            />
          )}

          {linkMode === "page" && !itemIsSocial && (
            <NavPageSelectSection
              availablePages={availablePages}
              selectedPageId={selectedPageId}
              itemUrl={itemUrl}
              onSelectPageId={selectPage}
              t={t}
            />
          )}

          {linkMode === "custom" && !itemIsSocial && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("navLabelEs")}
                value={itemLabelEs}
                onChange={(e) => onChangeItemLabelEs(e.target.value)}
                placeholder={t("navLabelEsPlaceholder")}
                autoFocus
              />
              <Input
                label={t("navLabelEn")}
                value={itemLabelEn}
                onChange={(e) => onChangeItemLabelEn(e.target.value)}
                placeholder={t("navLabelEnPlaceholder")}
              />
            </div>
          )}

          {linkMode !== "page" && !isEditingFixed && (
            <Input
              label={t("navUrl")}
              value={itemUrl}
              onChange={(e) => onChangeItemUrl(e.target.value)}
              placeholder={itemIsSocial ? t("navSocialUrlPlaceholder") : t("navUrlPlaceholder")}
              autoFocus={itemIsSocial}
            />
          )}

          {itemIsSocial && (
            <NavSocialIconPicker itemIcon={itemIcon} onChangeItemIcon={onChangeItemIcon} t={t} />
          )}

          {linkMode !== "page" && !isEditingFixed && (
            <div className="pt-1">
              <Checkbox
                checked={itemTarget === "_blank"}
                onChange={(checked) => onChangeItemTarget(checked ? "_blank" : "_self")}
                label={`${t("navNewTab")} (target='_blank')`}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            {tc("cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} loading={isSaving} disabled={isSaving}>
            {tc("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
