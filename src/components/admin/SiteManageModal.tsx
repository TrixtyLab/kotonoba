"use client";

import React from "react";
import { Plus, Edit3, Trash2, ExternalLink } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { normalizeLocale, type Locale } from "@/i18n/routing";
import { getLocalizedText } from "@/lib/utils/localization";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";
import type { SiteOption } from "@/components/admin/SiteSwitcher";

/** Props for {@link SiteManageModal}. */
export interface SiteManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: SiteOption[];
  currentSiteId: string;
  editingSiteId: string | null;
  isCreatingNew: boolean;
  siteToDelete: string | null;
  isPending: boolean;
  formName: string;
  onChangeFormName: (value: string) => void;
  formDomain: string;
  onChangeFormDomain: (value: string) => void;
  formSubtitle: string;
  onChangeFormSubtitle: (value: string) => void;
  formLocale: Locale;
  onChangeFormLocale: (value: Locale) => void;
  formTheme: "dark" | "light";
  onChangeFormTheme: (value: "dark" | "light") => void;
  onOpenCreate: () => void;
  onOpenEdit: (site: SiteOption) => void;
  onCancelForm: () => void;
  onSave: () => void;
  onSelectSite: (siteId: string) => void;
  onRequestDelete: (siteId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

/**
 * Super-admin modal dialog for creating, editing, activating, and deleting tenant blog sites.
 */
export function SiteManageModal({
  isOpen,
  onClose,
  sites,
  currentSiteId,
  editingSiteId,
  isCreatingNew,
  siteToDelete,
  isPending,
  formName,
  onChangeFormName,
  formDomain,
  onChangeFormDomain,
  formSubtitle,
  onChangeFormSubtitle,
  formLocale,
  onChangeFormLocale,
  formTheme,
  onChangeFormTheme,
  onOpenCreate,
  onOpenEdit,
  onCancelForm,
  onSave,
  onSelectSite,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SiteManageModalProps) {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");
  const locale = useLocale();

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t("siteManager")}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <p className="text-xs text-text-muted">{t("multiTenantHint")}</p>
            {!isCreatingNew && !editingSiteId && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenCreate}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                {t("addSite")}
              </Button>
            )}
          </div>

          {(isCreatingNew || editingSiteId) && (
            <div className="p-4 rounded-xl border border-border bg-surface-hover/30 space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-text">
                {editingSiteId ? t("editSite") : t("createSite")}
              </h4>

              <Input
                label={t("siteName")}
                placeholder={t("siteNamePlaceholder")}
                value={formName}
                onChange={(e) => onChangeFormName(e.target.value)}
              />

              <Input
                label={t("domain")}
                placeholder={t("domainPlaceholder")}
                value={formDomain}
                onChange={(e) => onChangeFormDomain(e.target.value)}
                helperText={t("multiTenantHint")}
              />

              <Input
                label={t("siteSubtitle")}
                placeholder={t("siteSubtitlePlaceholder")}
                value={formSubtitle}
                onChange={(e) => onChangeFormSubtitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={tc("language")}
                  value={formLocale}
                  onChange={(val) => onChangeFormLocale(normalizeLocale(val))}
                  options={[
                    { value: "es", label: "Español (es)" },
                    { value: "en", label: "English (en)" },
                  ]}
                />

                <Select
                  label={ts("theme")}
                  value={formTheme}
                  onChange={(val) => onChangeFormTheme(val === "light" ? "light" : "dark")}
                  options={[
                    { value: "dark", label: ts("themeDark") },
                    { value: "light", label: ts("themeLight") },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={onCancelForm} className="text-xs">
                  {tc("cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onSave}
                  loading={isPending}
                  className="text-xs"
                >
                  {editingSiteId ? t("saveChanges") : t("addSite")}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sites.map((s) => {
              const isCurrent = s.id === currentSiteId;
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    isCurrent
                      ? "border-accent bg-accent/5"
                      : "border-border bg-surface hover:border-border-hover"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text truncate">
                        {getLocalizedText(s.name, locale)}
                      </span>
                      {isCurrent && (
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">
                          {t("active")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                      {s.domain}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onSelectSite(s.id)}
                        disabled={isPending}
                        className="text-xs py-1 px-2.5 min-h-[28px]"
                      >
                        {t("activate")}
                      </Button>
                    )}

                    <a
                      href={buildSiteBaseUrl(s.domain)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                      title={t("viewPublicBlog")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onOpenEdit(s)}
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                      title={t("editSite")}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {sites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRequestDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-danger/10 text-danger transition-colors"
                        title={t("deleteSite")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(siteToDelete)}
        onClose={onCancelDelete}
        onConfirm={onConfirmDelete}
        title={t("deleteSite")}
        message={t("confirmDeleteSite")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </>
  );
}
