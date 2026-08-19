"use client";

import React, { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { updateSite } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { Palette, Image as ImageIcon, Upload, X, Loader2, Save } from "lucide-react";
import { useRouter } from "@/i18n/routing";

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
];

/**
 * Configuration properties for the BrandingSettingsClient component.
 */
export interface BrandingSettingsClientProps {
  /** Target site entity. */
  site: {
    id: string;
    name: string;
    domain: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    locale: string;
    theme: string;
    primaryColor?: string | null;
    fontFamily?: string | null;
  };
}

/**
 * Administrative branding configuration panel for adjusting accent colors, theme styles, logo images, and favicons.
 *
 * @param props - BrandingSettingsClientProps configuring site branding attributes.
 * @returns React JSX branding settings view.
 */
export function BrandingSettingsClient({ site }: BrandingSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [theme, setTheme] = useState<"dark" | "light">((site.theme as "dark" | "light") || "dark");
  const [primaryColor, setPrimaryColor] = useState(site.primaryColor || "#6366f1");
  const [logoUrl, setLogoUrl] = useState(site.logoUrl || "");
  const [faviconUrl, setFaviconUrl] = useState(site.faviconUrl || "");

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"logo" | "favicon">("logo");
  const [isUploading, setIsUploading] = useState<"logo" | "favicon" | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  function openMediaPicker(target: "logo" | "favicon") {
    setMediaTarget(target);
    setMediaPickerOpen(true);
  }

  function handleMediaSelect(url: string) {
    if (mediaTarget === "logo") {
      setLogoUrl(url);
      toast.success(t("saveSuccess"));
    } else {
      setFaviconUrl(url);
      toast.success(t("saveSuccess"));
    }
  }

  async function handleDirectUpload(e: React.ChangeEvent<HTMLInputElement>, target: "logo" | "favicon") {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(target);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "branding");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        if (target === "logo") {
          setLogoUrl(data.url);
        } else {
          setFaviconUrl(data.url);
        }
        toast.success(t("saveSuccess"));
      } else {
        toast.error(data.error || t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsUploading(null);
      e.target.value = "";
    }
  }

  async function handleSave() {
    startTransition(async () => {
      const res = await updateSite(site.id, {
        name: site.name,
        domain: site.domain,
        subtitle: site.subtitle || undefined,
        description: site.description || undefined,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
        locale: site.locale,
        theme,
        primaryColor,
        fontFamily: site.fontFamily || "Inter",
      });

      if (res.success) {
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        toast.error(t("saveError"));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Palette className="w-5 h-5 text-accent" />
          <span>{t("branding")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("brandingDesc")}</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Theme Mode */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text">{t("theme")}</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                theme === "dark"
                  ? "bg-accent/10 border-accent text-accent shadow-xs"
                  : "bg-surface-hover/50 border-border text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              <div className="w-full h-10 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-accent" />
              </div>
              <span>{t("themeDark")}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                theme === "light"
                  ? "bg-accent/10 border-accent text-accent shadow-xs"
                  : "bg-surface-hover/50 border-border text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              <div className="w-full h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <span className="w-4 h-4 rounded-full bg-accent" />
              </div>
              <span>{t("themeLight")}</span>
            </button>
          </div>
        </div>

        {/* Primary Accent Color */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-text">{t("primaryColor")}</label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPrimaryColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  primaryColor.toLowerCase() === c.toLowerCase()
                    ? "border-text scale-110 shadow-xs"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-7 h-7 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <span className="font-mono text-xs text-text-muted uppercase">{primaryColor}</span>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2 p-4 bg-surface-hover/20 border border-border rounded-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text">{t("logo")}</label>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> {t("removeImage")}
              </button>
            )}
          </div>

          {logoUrl ? (
            <div className="p-3 bg-surface rounded-lg border border-border flex items-center justify-center max-w-xs h-20">
              <img src={logoUrl} alt="Logo" className="max-h-14 max-w-full object-contain" />
            </div>
          ) : (
            <div className="h-16 rounded-lg border border-dashed border-border bg-surface-hover/30 flex items-center justify-center text-xs text-text-muted">
              {t("noLogoAssigned")}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDirectUpload(e, "logo")}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploading === "logo"}
              icon={isUploading === "logo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {t("uploadImage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openMediaPicker("logo")}
              icon={<ImageIcon className="w-3.5 h-3.5 text-accent" />}
              className="text-xs"
            >
              {t("mediaLibrary")}
            </Button>
          </div>
        </div>

        {/* Favicon */}
        <div className="space-y-2 p-4 bg-surface-hover/20 border border-border rounded-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text">{t("favicon")}</label>
            {faviconUrl && (
              <button
                type="button"
                onClick={() => setFaviconUrl("")}
                className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" /> {t("removeImage")}
              </button>
            )}
          </div>

          {faviconUrl ? (
            <div className="p-2 bg-surface rounded-lg border border-border inline-block">
              <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg border border-dashed border-border bg-surface-hover/30 flex items-center justify-center text-xs text-text-muted">
              ICO
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => handleDirectUpload(e, "favicon")}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => faviconInputRef.current?.click()}
              disabled={isUploading === "favicon"}
              icon={isUploading === "favicon" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {t("uploadImage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openMediaPicker("favicon")}
              icon={<ImageIcon className="w-3.5 h-3.5 text-accent" />}
              className="text-xs"
            >
              {t("mediaLibrary")}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isPending}
          icon={<Save className="w-4 h-4" />}
          className="text-xs"
        >
          {tc("save")}
        </Button>
      </div>

      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        title={mediaTarget === "logo" ? t("logo") : t("favicon")}
      />
    </div>
  );
}
