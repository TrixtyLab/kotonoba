"use client";

import { useState, useTransition } from "react";
import { createSite, updateSite, deleteSite } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Plus, Edit3, Trash2, Globe, ExternalLink, Check } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export interface SiteModel {
  id: string;
  name: string;
  domain: string;
  subtitle?: string | null;
  description?: string | null;
  locale: string;
  theme: "dark" | "light";
  primaryColor?: string | null;
  fontFamily?: string | null;
}

/**
 * Multi-tenant site manager allowing creation and maintenance of distinct blog domains and branding.
 */
export function SitesManagerClient({
  currentSiteId,
  initialSites,
}: {
  currentSiteId: string;
  initialSites: SiteModel[];
}) {
  const router = useRouter();
  const [sites, setSites] = useState(initialSites);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [locale, setLocale] = useState("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [isPending, startTransition] = useTransition();

  function openCreateModal() {
    setEditingId(null);
    setName("");
    setDomain("");
    setSubtitle("");
    setLocale("en");
    setTheme("dark");
    setPrimaryColor("#6366f1");
    setModalOpen(true);
  }

  function openEditModal(site: SiteModel) {
    setEditingId(site.id);
    setName(site.name);
    setDomain(site.domain);
    setSubtitle(site.subtitle || "");
    setLocale(site.locale || "en");
    setTheme(site.theme || "dark");
    setPrimaryColor(site.primaryColor || "#6366f1");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !domain.trim()) return;

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
        }
      } else {
        const res = await createSite(payload);
        if (res.success && res.id) {
          setSites((prev) => [
            ...prev,
            { id: res.id as string, ...payload },
          ]);
          setModalOpen(false);
        }
      }
    });
  }

  async function handleDelete(id: string) {
    if (sites.length <= 1) {
      alert("Cannot delete the only remaining blog.");
      return;
    }
    if (!confirm("Are you sure you want to delete this blog and all its articles? This cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      const res = await deleteSite(id);
      if (res.success) {
        setSites((prev) => prev.filter((s) => s.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Multi-Blog Manager</h1>
          <p className="text-xs text-text-muted">Host and govern multiple independent blogs with custom domains/subdomains</p>
        </div>

        <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          Create New Blog
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map((s) => {
          const isCurrent = s.id === currentSiteId;

          return (
            <div
              key={s.id}
              className={`glass p-6 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                isCurrent ? "border-primary ring-2 ring-primary/20 shadow-xl" : "border-border hover:border-border/80"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <h3 className="text-base font-bold text-text truncate">{s.name}</h3>
                  </div>
                  {isCurrent ? (
                    <Badge variant="primary" className="bg-primary/20 text-primary">
                      <Check className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-mono text-primary font-semibold truncate">{s.domain}</p>
                  {s.subtitle && <p className="text-xs text-text-muted line-clamp-2">{s.subtitle}</p>}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-text-muted pt-2">
                  <span className="uppercase font-mono font-semibold">{s.locale}</span>
                  <span>•</span>
                  <span className="capitalize">{s.theme} mode</span>
                  <span>•</span>
                  <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: s.primaryColor || "#6366f1" }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-1">
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        router.push(`/admin?site=${s.id}`);
                        router.refresh();
                      }}
                      className="text-xs text-primary hover:underline p-0 mr-2"
                    >
                      Switch Here
                    </Button>
                  )}
                  <a
                    href={`http://${s.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                    title="Visit site"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(s)}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                    title="Edit blog settings"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {sites.length > 1 && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                      title="Delete blog"
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Blog Instance" : "Create New Blog Instance"}
      >
        <div className="space-y-4">
          <Input
            label="Blog Name"
            placeholder="e.g. Mobile Engineering Blog"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Domain / Subdomain (Host header)"
            placeholder="e.g. mobile.mycompany.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Input
            label="Subtitle / Tagline"
            placeholder="iOS, Android & React Native deep dives"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Default Language
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-xs text-text focus:outline-none focus:border-primary"
              >
                <option value="en">English (en)</option>
                <option value="es">Español (es)</option>
                <option value="fr">Français (fr)</option>
                <option value="de">Deutsch (de)</option>
                <option value="pt">Português (pt)</option>
                <option value="zh">中文 (zh)</option>
                <option value="ja">日本語 (ja)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value === "light" ? "light" : "dark")}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-xs text-text focus:outline-none focus:border-primary"
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Theme Accent Color
            </label>
            <div className="flex gap-2.5">
              {["#6366f1", "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrimaryColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform btn-press ${
                    primaryColor === c ? "ring-2 ring-white scale-110" : "opacity-80 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={isPending}>
              {editingId ? "Save Changes" : "Create Blog"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
