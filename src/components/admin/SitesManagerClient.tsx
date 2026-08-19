"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createSite, updateSite, deleteSite, setActiveSiteAction } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Edit3, Trash2, Globe, ExternalLink, Check } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Complete database entity model representation of a website instance.
 */
export interface SiteModel {
  /** Unique database identifier. */
  id: string;
  /** Display title of the site. */
  name: string;
  /** Hostname domain. */
  domain: string;
  /** Subtitle tagline. */
  subtitle?: string | null;
  /** Descriptive overview. */
  description?: string | null;
  /** Default language locale code. */
  locale: string;
  /** Active theme scheme. */
  theme: "dark" | "light";
  /** Primary accent color hex code. */
  primaryColor?: string | null;
  /** Active typography font family. */
  fontFamily?: string | null;
  /** Serialized navigation links JSON string. */
  navLinks?: string | null;
  /** Navigation alignment setting. */
  navAlignment?: "left" | "center" | "right" | null;
}

/**
 * Multi-site management panel allowing administrators to provision new blog domains, update site branding, and activate workspaces.
 *
 * @param props - Object containing the currentSiteId and initial SiteModel list.
 * @returns React JSX multi-site workspace manager view.
 */
export function SitesManagerClient({
  currentSiteId,
  initialSites,
}: {
  currentSiteId: string;
  initialSites: SiteModel[];
}) {
  const t = useTranslations("admin");
  const ts = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [sites, setSites] = useState(initialSites);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [locale, setLocale] = useState("es");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [isPending, startTransition] = useTransition();

  function openCreateModal() {
    setEditingId(null);
    setName("");
    setDomain("");
    setSubtitle("");
    setLocale("es");
    setTheme("dark");
    setPrimaryColor("#3b82f6");
    setModalOpen(true);
  }

  function openEditModal(site: SiteModel) {
    setEditingId(site.id);
    setName(site.name);
    setDomain(site.domain);
    setSubtitle(site.subtitle || "");
    setLocale(site.locale || "es");
    setTheme(site.theme || "dark");
    setPrimaryColor(site.primaryColor || "#3b82f6");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error(ts("siteName"));
      return;
    }
    if (!domain.trim()) {
      toast.error(ts("domain"));
      return;
    }

    startTransition(async () => {
      const payload = {
        name,
        domain,
        subtitle,
        description: subtitle,
        locale,
        theme,
        primaryColor,
        fontFamily: "Inter",
      };

      if (editingId) {
        const res = await updateSite(editingId, payload);
        if (res.success) {
          setSites((prev) =>
            prev.map((s) => (s.id === editingId ? { ...s, ...payload } : s))
          );
          setModalOpen(false);
          toast.success(t("siteUpdated"));
        } else {
          toast.error(ts("saveError"));
        }
      } else {
        const res = await createSite(payload);
        if (res.success && res.id) {
          setSites((prev) => [
            ...prev,
            { id: res.id as string, ...payload },
          ]);
          setModalOpen(false);
          toast.success(t("siteCreated"));
        } else {
          toast.error(ts("saveError"));
        }
      }
    });
  }

  function handleDeleteClick(id: string) {
    if (sites.length <= 1) {
      toast.error("No es posible eliminar el único blog registrado.");
      return;
    }
    setSiteToDelete(id);
  }

  async function handleConfirmDelete() {
    if (!siteToDelete) return;
    const id = siteToDelete;
    startTransition(async () => {
      const res = await deleteSite(id);
      if (res.success) {
        setSites((prev) => prev.filter((s) => s.id !== id));
        toast.success(t("siteDeleted"));
      } else {
        toast.error(ts("saveError"));
      }
      setSiteToDelete(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">{t("siteManager")}</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {t("siteManager")} ({sites.length} {tc("sites").toLowerCase()}).
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus className="w-3.5 h-3.5" />}>
          {t("addSite")}
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map((s) => {
          const isCurrent = s.id === currentSiteId;
          const displayName = getLocalizedText(s.name, s.locale);
          const displaySubtitle = getLocalizedText(s.subtitle, s.locale);

          return (
            <div
              key={s.id}
              className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 transition-all bg-surface ${
                isCurrent
                  ? "border-accent ring-1 ring-accent shadow-xs"
                  : "border-border hover:border-border-hover shadow-2xs"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-4 h-4 text-accent shrink-0" />
                    <h3 className="text-sm font-bold text-text truncate">{displayName}</h3>
                  </div>
                  {isCurrent ? (
                    <Badge variant="success">
                      <Check className="w-3 h-3 mr-1" /> {t("activeSite")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{tc("inactive")}</Badge>
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-mono text-accent font-semibold truncate">{s.domain}</p>
                  {displaySubtitle && <p className="text-xs text-text-muted line-clamp-2">{displaySubtitle}</p>}
                </div>

                <div className="flex items-center gap-2.5 text-[11px] text-text-muted pt-2 border-t border-border">
                  <span className="uppercase font-mono font-semibold">{s.locale}</span>
                  <span>•</span>
                  <span className="capitalize">{s.theme === "dark" ? ts("themeDark") : ts("themeLight")}</span>
                  <span>•</span>
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-border"
                    style={{ backgroundColor: s.primaryColor || "#3b82f6" }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  {!isCurrent ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          await setActiveSiteAction(s.id);
                          toast.success(t("siteActivated"));
                          router.refresh();
                        });
                      }}
                      className="text-xs"
                    >
                      {tc("admin")}
                    </Button>
                  ) : (
                    <span className="text-xs text-accent font-semibold">{t("activeSite")}</span>
                  )}
                  <a
                    href={`http://${s.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                    title={tc("view")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(s)}
                    className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                    title={tc("edit")}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {sites.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(s.id)}
                      className="p-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
                      title={tc("delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? tc("edit") : t("addSite")}
      >
        <div className="space-y-3 text-xs">
          <Input
            label={ts("siteName")}
            placeholder="ej. Blog de Tecnología"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t("domain")}
            placeholder="ej. blog.midominio.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Input
            label={ts("siteSubtitle")}
            placeholder="Tutoriales, artículos y tecnología"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={ts("defaultLocale")}
              value={locale}
              onChange={(val) => setLocale(val)}
              options={[
                { value: "es", label: "Español (es)" },
                { value: "en", label: "English (en)" },
              ]}
            />

            <Select
              label={ts("theme")}
              value={theme}
              onChange={(val) => setTheme(val === "light" ? "light" : "dark")}
              options={[
                { value: "dark", label: ts("themeDark") },
                { value: "light", label: ts("themeLight") },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={isPending}>
              {editingId ? t("saveChanges") : t("addSite")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(siteToDelete)}
        onClose={() => setSiteToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={tc("delete")}
        message={tc("confirmDelete")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        variant="danger"
        isLoading={isPending}
      />
    </div>
  );
}
