"use client";

import React, { useState, useTransition } from "react";
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
}

/**
 * Configuration properties for the SiteSwitcher component.
 */
export interface SiteSwitcherProps {
  /** Currently active workspace site. */
  currentSite: SiteOption;
  /** All available registered sites. */
  allSites: SiteOption[];
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
  collapsed = false,
}: SiteSwitcherProps) {
  const router = useRouter();
  const toast = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sites management state
  const [sites, setSites] = useState<SiteOption[]>(initialSites);
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
    setFormName(s.name);
    setFormDomain(s.domain);
    setFormSubtitle(s.subtitle || "");
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
    if (!formName.trim()) {
      toast.error("El nombre del blog es obligatorio");
      return;
    }
    if (!formDomain.trim()) {
      toast.error("El dominio es obligatorio");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: formName.trim(),
        domain: formDomain.trim(),
        subtitle: formSubtitle.trim(),
        description: formSubtitle.trim(),
        locale: formLocale,
        theme: formTheme,
        primaryColor: formColor,
        fontFamily: "Inter",
      };

      if (editingSiteId) {
        const res = await updateSite(editingSiteId, payload);
        if (res.success) {
          setSites((prev) =>
            prev.map((s) => (s.id === editingSiteId ? { ...s, ...payload } : s))
          );
          setEditingSiteId(null);
          toast.success("Blog actualizado");
          router.refresh();
        } else {
          toast.error("Error al actualizar el blog");
        }
      } else {
        const res = await createSite(payload);
        if (res.success && res.id) {
          const newSite: SiteOption = { id: res.id as string, ...payload };
          setSites((prev) => [...prev, newSite]);
          setIsCreatingNew(false);
          toast.success("Blog creado con éxito");
          router.refresh();
        } else {
          toast.error("Error al crear el blog");
        }
      }
    });
  }

  async function handleConfirmDelete() {
    if (!siteToDelete) return;
    const id = siteToDelete;
    startTransition(async () => {
      const res = await deleteSite(id);
      if (res.success) {
        setSites((prev) => prev.filter((s) => s.id !== id));
        toast.success("Blog eliminado");
        router.refresh();
      } else {
        toast.error("Error al eliminar el blog");
      }
      setSiteToDelete(null);
    });
  }

  return (
    <>
      <div className="relative w-full">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isPending}
            className="w-10 h-10 mx-auto rounded-lg border border-border bg-surface-hover/40 hover:bg-surface-hover flex items-center justify-center text-text transition-colors"
            title={`Blog: ${currentSite.name}`}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin" />
            ) : (
              <Globe className="w-4 h-4 text-accent" />
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
              <div className="w-6 h-6 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0 truncate flex-1">
                <p className="text-xs font-bold text-text truncate leading-tight group-hover:text-accent transition-colors">
                  {currentSite.name}
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
                Blogs Activos ({sites.length})
              </p>
              <div className="space-y-0.5 my-1 max-h-48 overflow-y-auto">
                {sites.map((s) => (
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
                    <div className="min-w-0 truncate">
                      <p className="font-medium text-text truncate leading-tight">{s.name}</p>
                      <p className="text-[10px] text-text-muted truncate leading-tight mt-0.5 font-mono">{s.domain}</p>
                    </div>
                    {currentSite.id === s.id && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />}
                  </button>
                ))}
              </div>

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
                  <span>Añadir / Administrar Blogs</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Direct Manage & Add Sites Modal */}
      <Modal
        isOpen={manageModalOpen}
        onClose={() => {
          setManageModalOpen(false);
          setEditingSiteId(null);
          setIsCreatingNew(false);
        }}
        title="Gestor de Blogs"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Action */}
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <p className="text-xs text-text-muted">
              Administra los blogs independientes de tu servidor.
            </p>
            {!isCreatingNew && !editingSiteId && (
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateForm}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Nuevo Blog
              </Button>
            )}
          </div>

          {/* Form when Creating or Editing */}
          {(isCreatingNew || editingSiteId) ? (
            <div className="p-4 rounded-xl border border-border bg-surface-hover/30 space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold text-text">
                {editingSiteId ? "Editar Blog" : "Crear Nuevo Blog"}
              </h4>

              <Input
                label="Nombre del Blog"
                placeholder="ej. Blog de Tecnología"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />

              <Input
                label="Dominio / Host HTTP"
                placeholder="ej. blog.midominio.com o localhost:3000"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                helperText="Enrutamiento multi-tenant basado en el host de la petición"
              />

              <Input
                label="Subtítulo / Lema"
                placeholder="Reflexiones sobre tecnología y diseño"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Idioma"
                  value={formLocale}
                  onChange={(val) => setFormLocale(val)}
                  options={[
                    { value: "es", label: "Español (es)" },
                    { value: "en", label: "English (en)" },
                  ]}
                />

                <Select
                  label="Tema"
                  value={formTheme}
                  onChange={(val) => setFormTheme(val === "light" ? "light" : "dark")}
                  options={[
                    { value: "dark", label: "Oscuro" },
                    { value: "light", label: "Claro" },
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
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSite}
                  loading={isPending}
                  className="text-xs"
                >
                  {editingSiteId ? "Guardar Cambios" : "Crear Blog"}
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
                      <span className="text-xs font-bold text-text truncate">{s.name}</span>
                      {isCurrent ? (
                        <Badge variant="success" className="text-[10px] py-0 px-1.5">Activo</Badge>
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
                        Activar
                      </Button>
                    )}

                    <a
                      href={`http://${s.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                      title="Ver sitio público"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => openEditForm(s)}
                      className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-accent transition-colors"
                      title="Editar blog"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {sites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSiteToDelete(s.id)}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
                        title="Eliminar blog"
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
        title="Eliminar Blog"
        message="¿Estás seguro de que deseas eliminar este blog y todos sus artículos asociados de forma permanente?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isPending}
      />
    </>
  );
}
