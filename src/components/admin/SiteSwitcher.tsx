"use client";

import React, { useState, useTransition } from "react";
import { ChevronDown, Check, Plus, Loader2 } from "lucide-react";
import { useRouter, normalizeLocale, type Locale } from "@/i18n/routing";
import { setActiveSiteAction, createSite, updateSite, deleteSite } from "@/actions/sites";
import { useToast } from "@/components/ui/Toast";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedText } from "@/lib/utils/localization";
import { SiteManageModal } from "@/components/admin/SiteManageModal";

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

  const [sites, setSites] = useState<SiteOption[]>(initialSites);
  const [prevInitialSites, setPrevInitialSites] = useState<SiteOption[]>(initialSites);

  if (prevInitialSites !== initialSites) {
    setPrevInitialSites(initialSites);
    setSites(initialSites);
  }

  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formLocale, setFormLocale] = useState<Locale>("es");
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
    setFormLocale(normalizeLocale(s.locale));
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

      {canManageSites && (
        <SiteManageModal
          isOpen={manageModalOpen}
          onClose={() => {
            setManageModalOpen(false);
            setEditingSiteId(null);
            setIsCreatingNew(false);
          }}
          sites={sites}
          currentSiteId={currentSite.id}
          editingSiteId={editingSiteId}
          isCreatingNew={isCreatingNew}
          siteToDelete={siteToDelete}
          isPending={isPending}
          formName={formName}
          onChangeFormName={setFormName}
          formDomain={formDomain}
          onChangeFormDomain={setFormDomain}
          formSubtitle={formSubtitle}
          onChangeFormSubtitle={setFormSubtitle}
          formLocale={formLocale}
          onChangeFormLocale={setFormLocale}
          formTheme={formTheme}
          onChangeFormTheme={setFormTheme}
          onOpenCreate={openCreateForm}
          onOpenEdit={openEditForm}
          onCancelForm={() => {
            setIsCreatingNew(false);
            setEditingSiteId(null);
          }}
          onSave={handleSaveSite}
          onSelectSite={(siteId) => {
            handleSelectSite(siteId);
            setManageModalOpen(false);
          }}
          onRequestDelete={setSiteToDelete}
          onCancelDelete={() => setSiteToDelete(null)}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </>
  );
}
