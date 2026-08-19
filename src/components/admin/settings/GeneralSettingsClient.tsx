"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateSite } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Save, Settings, Languages, Globe } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { getLocalizedMap, packLocalizedMap } from "@/lib/utils/localization";

/**
 * Configuration properties for the GeneralSettingsClient component.
 */
export interface GeneralSettingsClientProps {
  /** Target site entity. */
  site: {
    id: string;
    name: string;
    domain: string;
    subtitle?: string | null;
    description?: string | null;
    locale: string;
    theme: string;
    primaryColor?: string | null;
    fontFamily?: string | null;
  };
}

/**
 * Administrative panel view for managing general site attributes such as localized names, subtitles, descriptions, and default locale.
 *
 * @param props - GeneralSettingsClientProps configuring site metadata.
 * @returns React JSX general settings configuration view.
 */
export function GeneralSettingsClient({ site }: GeneralSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeLangTab, setActiveLangTab] = useState<"es" | "en">("es");

  const [namesMap, setNamesMap] = useState<Record<string, string>>(() =>
    getLocalizedMap(site.name, ["es", "en"])
  );
  const [subtitlesMap, setSubtitlesMap] = useState<Record<string, string>>(() =>
    getLocalizedMap(site.subtitle, ["es", "en"])
  );
  const [descriptionsMap, setDescriptionsMap] = useState<Record<string, string>>(() =>
    getLocalizedMap(site.description, ["es", "en"])
  );

  const [domain, setDomain] = useState(site.domain);
  const [locale, setLocale] = useState(site.locale || "es");

  async function handleSave() {
    startTransition(async () => {
      const packedName = packLocalizedMap(namesMap) || namesMap.es || namesMap.en || site.name;
      const packedSubtitle = packLocalizedMap(subtitlesMap);
      const packedDesc = packLocalizedMap(descriptionsMap);

      const res = await updateSite(site.id, {
        name: packedName,
        domain,
        subtitle: packedSubtitle || undefined,
        description: packedDesc || undefined,
        locale,
        theme: (site.theme as "dark" | "light") || "dark",
        primaryColor: site.primaryColor || "#6366f1",
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
          <Settings className="w-5 h-5 text-accent" />
          <span>{t("general")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("generalDesc")}</p>
      </div>

      {/* Language Switcher Tabs for Multilingual Blog Content */}
      <div className="p-4 bg-surface-hover/30 border border-border rounded-xl space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <Globe className="w-4 h-4 text-accent" />
            <span>Contenido Multilingüe del Blog</span>
          </div>

          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveLangTab("es")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeLangTab === "es"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Español (ES)
            </button>
            <button
              type="button"
              onClick={() => setActiveLangTab("en")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                activeLangTab === "en"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-text-muted hover:text-text"
              }`}
            >
              English (EN)
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          <Input
            label={`${t("siteName")} (${activeLangTab.toUpperCase()})`}
            value={namesMap[activeLangTab] || ""}
            onChange={(e) =>
              setNamesMap((prev) => ({ ...prev, [activeLangTab]: e.target.value }))
            }
            placeholder={activeLangTab === "es" ? "Mi Blog Tecnológico" : "My Tech Blog"}
            required
          />

          <Input
            label={`${t("siteSubtitle")} (${activeLangTab.toUpperCase()})`}
            value={subtitlesMap[activeLangTab] || ""}
            onChange={(e) =>
              setSubtitlesMap((prev) => ({ ...prev, [activeLangTab]: e.target.value }))
            }
            placeholder={
              activeLangTab === "es"
                ? "Pensamientos, tutoriales e historias"
                : "Thoughts, tutorials & stories"
            }
          />

          <Textarea
            label={`${t("siteDescription")} (${activeLangTab.toUpperCase()})`}
            value={descriptionsMap[activeLangTab] || ""}
            onChange={(e) =>
              setDescriptionsMap((prev) => ({ ...prev, [activeLangTab]: e.target.value }))
            }
            placeholder={
              activeLangTab === "es"
                ? "Descripción del blog para motores de búsqueda..."
                : "Blog description for search engines..."
            }
            className="min-h-[90px] text-xs"
          />
        </div>
      </div>

      {/* Global Site Parameters */}
      <div className="space-y-4 max-w-2xl">
        <Input
          label={t("domain")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="blog.example.com"
          helperText={t("domainHint")}
          required
        />

        <Select
          label={t("defaultLocale")}
          value={locale}
          onChange={(val) => setLocale(val)}
          options={[
            { value: "es", label: "Español (es)" },
            { value: "en", label: "English (en)" },
          ]}
        />
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
    </div>
  );
}
