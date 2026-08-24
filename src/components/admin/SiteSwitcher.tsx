"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Globe, ChevronDown, Check, Plus, Loader2, Edit3, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { setActiveSiteAction, createSite, updateSite, deleteSite } from "@/actions/sites";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedText } from "@/lib/utils/localization";

function getSitePublicUrl(domain?: string | null): string {
  if (!domain) return "/";
  const clean = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim();
  if (!clean) return "/";

  const isLocal =
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.endsWith(".localhost") ||
    clean.startsWith("localhost:");

  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${clean}`;
}

/**
 * Representation of a selectable blog site in the tenant switcher dropdown.
 */
export interface SiteOption {
  /** Unique database identifier of the site. */
  id: string;
  /** Display title. */
  name: string;
  /** Bound hostname. */
  domain: string;
  /** Subtitle tagline. */
  subtitle?: string | null;
  /** Default language code. */
  locale?: string;
  /** Theme preference. */
  theme?: "dark" | "light";
  /** Primary accent color. */
  primaryColor?: string | null;
  /** Favicon asset URL. */
  faviconUrl?: string | null;
  /** Logo asset URL. */
  logoUrl?: string | null;
}

/**
 * Configuration properties for the SiteSwitcher component.
 */
export interface SiteSwitcherProps {
  /** Currently active workspace site. */
  currentSite: SiteOption;
  /** All available registered sites. */
  allSites: SiteOption[];
  /** Flag indicating whether the caller has permissions to create and manage sites (super_admin). */
  canManageSites?: boolean;
  /** Flag indicating whether the parent sidebar is collapsed. */
  collapsed?: boolean;
}

/**
 * Tenant workspace selector component in the sidebar with built-in modal dialogs for creating, modifying, and deleting blog instances.
 *
 * @param props - SiteSwitcherProps configuring active site, sites catalog, and collapse state.
 * @returns React JSX site switcher element.
 */
export function SiteSwitcher({
  currentSite,
  allSites: initialSites,
  canManageSites = false,
  collapsed = false,
}: SiteSwitcherProps) {
  const t = useTranslations("sites");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sites management state
  const [sites, setSites] = useState<SiteOption[]>(initialSites);

  useEffect(() => {
    setSites(initialSites);
  }, [initialSites]);

  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formLocale, setFormLocale] = useState("es");
  const [formTheme, setFormTheme] = useState<"dark" | "light">("dark");
  const [formColor, setFormColor] = useState("#3b82f6");

  function openCreateForm() {
    setEditingSiteId(null);
    setFormName("");
    setFormDomain("");
    setFormSubtitle("");
    setFormLocale("es");
    setFormTheme("dark");
    setFormColor("#3b82f6");
    setIsCreatingNew(true);
  }

  function openEditForm(s: SiteOption) {
    setEditingSiteId(s.id);
    setFormName(getLocalizedText(s.name, s.locale || locale));
    setFormDomain(s.domain);
    setFormSubtitle(getLocalizedText(s.subtitle, s.locale || locale));
    setFormLocale(s.locale || "es");
    setFormTheme(s.theme || "dark");
    setFormColor(s.primaryColor || "#3b82f6");
    setIsCreatingNew(false);
  }

  async function handleSelectSite(siteId: string) {
    if (siteId === currentSite.id) {
      setDropdownOpen(false);
      return;
    }
    setDropdownOpen(false);
    startTransition(async () => {
      await setActiveSiteAction(siteId);
      router.refresh();
    });
  }

  async function handleSaveSite() {
    if (!formName.trim() || !formDomain.trim()) {
      toast.error(ts("blogNameRequired"));
      return;
    }

    startTransition(async () => {
      if (editingSiteId) {
        const res = await updateSite(editingSiteId, {
          name: formName.trim(),
          domain: formDomain.trim(),
          subtitle: formSubtitle.trim(),
          locale: formLocale,
          theme: formTheme,
          primaryColor: formColor,
        });

        if (res.success) {
          toast.success(ts("saveSuccess"));
          setSites((prev) =>
            prev.map((s) =>
              s.id === editingSiteId
                ? {
                    ...s,
                    name: formName.trim(),
                    domain: formDomain.trim(),
                    subtitle: formSubtitle.trim(),
                    locale: formLocale,
                    theme: formTheme,
                    primaryColor: formColor,
                  }
                : s
            )
          );
          setEditingSiteId(null);
          router.refresh();
        } else {
          toast.error(ts("saveError"));
        }
      } else {
        const res = await createSite({
          name: formName.trim(),
          domain: formDomain.trim(),
          subtitle: formSubtitle.trim(),
          locale: formLocale,
          theme: formTheme,
          primaryColor: formColor,
        });

        if (res.success && res.id) {
          toast.success(ts("saveSuccess"));
          const newSite: SiteOption = {
            id: res.id as string,
            name: formName.trim(),
            domain: formDomain.trim(),
            subtitle: formSubtitle.trim(),
            locale: formLocale,
            theme: formTheme,
            primaryColor: formColor,
          };
          setSites((prev) => [...prev, newSite]);
          setIsCreatingNew(false);
          router.refresh();
        } else {
          toast.error(ts("saveError"));
        }
      }
    });
  }

  async function handleDeleteSite(siteId: string) {
    startTransition(async () => {
      const res = await deleteSite(siteId);
      if (res.success) {
        toast.success(tc("deleted"));
        setSites((prev) => prev.filter((s) => s.id !== siteId));
        if (currentSite.id === siteId) {
          router.push("/admin");
        } else {
          router.refresh();
        }
      } else {
        toast.error(ts("saveError"));
      }
      setSiteToDelete(null);
    });
  }

  function handleConfirmDelete() {
    if (siteToDelete) {
      handleDeleteSite(siteToDelete);
    }
  }

  const currentDisplayName = getLocalizedText(currentSite.name, locale);
  const currentIconUrl = currentSite.faviconUrl || currentSite.logoUrl || "/icon.svg";

  return (
    <>
      <div className="relative w-full">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isPending}
            className="w-10 h-10 mx-auto rounded-lg border border-border bg-surface-hover/40 hover:bg-surface-hover flex items-center justify-center text-text transition-colors"
            title={`Blog: ${currentDisplayName}`}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            ) : (
              <img src={currentIconUrl} alt="" className="w-5 h-5 object-contain" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isPending}
            className="w-full flex items-center justify-between p-2 rounded-lg border border-border bg-surface-hover/40 hover:bg-surface-hover transition-colors text-left group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-md bg-surface-hover/80 border border-border/80 flex items-center justify-center shrink-0 overflow-hidden">
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <img src={currentIconUrl} alt="" className="w-4 h-4 object-contain" />
                )}
              </div>
              <div className="min-w-0 truncate flex-1">
                <p className="text-xs font-bold text-text truncate leading-tight group-hover:text-accent transition-colors">
                  {currentDisplayName}
                </p>
                <p className="text-[10px] text-text-muted truncate leading-tight mt-0.5 font-mono">
                  {currentSite.domain}
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0 ml-1.5" />
          </button>
        )}

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-surface shadow-xl z-50 p-1.5 border border-border animate-slide-up">
              <p className="text-[10px] uppercase font-bold text-text-muted px-2 py-1 tracking-wider">
                {t("activeSite")} ({sites.length})
              </p>
              <div className="space-y-0.5 my-1 max-h-48 overflow-y-auto">
                {sites.map((s) => {
                  const sName = getLocalizedText(s.name, locale);
                  const sIcon = s.faviconUrl || s.logoUrl || "/icon.svg";
                  return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSite(s.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors ${
                      currentSite.id === s.id
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-text-muted hover:text-text hover:bg-surface-hover/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <div className="w-5 h-5 rounded-sm bg-surface-hover border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={sIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="font-medium text-text truncate leading-tight">{sName}</p>
                        <p className="text-[10px] text-text-muted truncate leading-tight mt-0.5 font-mono">{s.domain}</p>
                      </div>
                    </div>
                    {currentSite.id === s.id && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />}
                  </button>
                )})}
              </div>

              {canManageSites && (
                <div className="pt-1 mt-1 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      setEditingSiteId(null);
                      setIsCreatingNew(false);
                      setManageModalOpen(true);
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-accent font-semibold hover:bg-accent/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("manageSites")}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Direct Manage & Add Sites Modal (super_admin only) */}
      {canManageSites && (
        <>
          <Modal
            isOpen={manageModalOpen}
            onClose={() => {
              setManageModalOpen(false);
              setEditingSiteId(null);
              setIsCreatingNew(false);
            }}
            title={t("siteManager")}
          >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Action */}
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <p className="text-xs text-text-muted">
              {t("multiTenantHint")}
            </p>
            {!isCreatingNew && !editingSiteId && (
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateForm}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                {t("addSite")}
              </Button>
            )}
          </div>

          {/* Form when Creating or Editing */}
          {(isCreatingNew || editingSiteId) ? (
            <div className="p-4 rounded-xl border border-border bg-surface-hover/30 space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-text">
                {editingSiteId ? t("editSite") : t("createSite")}
              </h4>

              <Input
                label={t("siteName")}
                placeholder="ej. Blog de Tecnología"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />

              <Input
                label={t("domain")}
                placeholder="ej. blog.midominio.com o localhost:3000"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                helperText={t("multiTenantHint")}
              />

              <Input
                label={t("siteSubtitle")}
                placeholder="Reflexiones sobre tecnología y diseño"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={tc("language")}
                  value={formLocale}
                  onChange={(val) => setFormLocale(val)}
                  options={[
                    { value: "es", label: "Español (es)" },
                    { value: "en", label: "English (en)" },
                  ]}
                />

                <Select
                  label={ts("theme")}
                  value={formTheme}
                  onChange={(val) => setFormTheme(val === "light" ? "light" : "dark")}
                  options={[
                    { value: "dark", label: ts("themeDark") },
                    { value: "light", label: ts("themeLight") },
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingSiteId(null);
                  }}
                  className="text-xs"
                >
                  {tc("cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSite}
                  loading={isPending}
                  className="text-xs"
                >
                  {editingSiteId ? t("saveChanges") : t("addSite")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* List of Sites */}
          <div className="space-y-2">
            {sites.map((s) => {
              const isCurrent = s.id === currentSite.id;
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
                      <span className="text-xs font-bold text-text truncate">{getLocalizedText(s.name, locale)}</span>
                      {isCurrent ? (
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">{t("active")}</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">{s.domain}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          handleSelectSite(s.id);
                          setManageModalOpen(false);
                        }}
                        disabled={isPending}
                        className="text-xs py-1 px-2.5 min-h-[28px]"
                      >
                        {t("activate")}
                      </Button>
                    )}

                    <a
                      href={getSitePublicUrl(s.domain)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                      title={t("viewPublicBlog")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => openEditForm(s)}
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                      title={t("editSite")}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {sites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSiteToDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
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

      {/* Confirm Delete Site Modal */}
      <ConfirmModal
        isOpen={Boolean(siteToDelete)}
        onClose={() => setSiteToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t("deleteSite")}
        message={t("confirmDeleteSite")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
      </>
      )}
    </>
  );
}
