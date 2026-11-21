"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateSite } from "@/actions/sites";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  SiteTranslationsSection,
  type AdditionalTranslation,
  type SiteLanguageOption,
} from "@/components/admin/settings/SiteTranslationsSection";
import { SupportedLocalesSection } from "@/components/admin/settings/SupportedLocalesSection";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { Settings } from "lucide-react";
import { useRouter, LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from "@/i18n/routing";
import { getLocalizedText, getLocalizedMap, packLocalizedMap } from "@/lib/utils/localization";

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
};

const AVAILABLE_LANGUAGES: SiteLanguageOption[] = LOCALES.map((code) => ({
  code,
  label: `${LOCALE_NAMES[code as Locale] || code} (${code.toUpperCase()})`,
  flag: LOCALE_FLAGS[code] || "🌐",
}));

/** Configuration properties for the GeneralSettingsClient component. */
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
    supportedLocales?: string | null;
  };
}

function buildInitialTranslations(
  site: GeneralSettingsClientProps["site"],
  initialDefaultLocale: string
): AdditionalTranslation[] {
  const rawNames = getLocalizedMap(site.name, []);
  const rawSubtitles = getLocalizedMap(site.subtitle, []);
  const rawDescriptions = getLocalizedMap(site.description, []);

  const keys = Array.from(
    new Set([
      ...Object.keys(rawNames),
      ...Object.keys(rawSubtitles),
      ...Object.keys(rawDescriptions),
    ])
  );

  const list: AdditionalTranslation[] = [];
  for (const key of keys) {
    if (
      key !== initialDefaultLocale &&
      (rawNames[key] || rawSubtitles[key] || rawDescriptions[key])
    ) {
      list.push({
        code: key,
        name: rawNames[key] || "",
        subtitle: rawSubtitles[key] || "",
        description: rawDescriptions[key] || "",
      });
    }
  }
  return list;
}

/**
 * Administrative panel view for managing general site attributes, localized metadata, and domain parameters.
 */
export function GeneralSettingsClient({ site }: GeneralSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialDefaultLocale = normalizeLocale(site.locale);
  const [defaultLocale, setDefaultLocale] = useState<Locale>(initialDefaultLocale);
  const [defaultName, setDefaultName] = useState(() =>
    getLocalizedText(site.name, initialDefaultLocale)
  );
  const [defaultSubtitle, setDefaultSubtitle] = useState(() =>
    getLocalizedText(site.subtitle, initialDefaultLocale)
  );
  const [defaultDescription, setDefaultDescription] = useState(() =>
    getLocalizedText(site.description, initialDefaultLocale)
  );
  const [translations, setTranslations] = useState<AdditionalTranslation[]>(() =>
    buildInitialTranslations(site, initialDefaultLocale)
  );

  const [selectedLocales, setSelectedLocales] = useState<string[]>(() => {
    if (site.supportedLocales) {
      try {
        const parsed = JSON.parse(site.supportedLocales);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback to English
      }
    }
    return ["en"];
  });

  const [domain, setDomain] = useState(site.domain);
  const [addLangCode, setAddLangCode] = useState<string>("");

  const unusedLanguages = AVAILABLE_LANGUAGES.filter(
    (lang) => lang.code !== defaultLocale && !translations.some((tr) => tr.code === lang.code)
  );

  function handleAddTranslation() {
    if (!addLangCode || translations.some((tr) => tr.code === addLangCode)) return;
    setTranslations((prev) => [
      ...prev,
      { code: addLangCode, name: "", subtitle: "", description: "" },
    ]);
    setAddLangCode("");
  }

  function handleRemoveTranslation(code: string) {
    setTranslations((prev) => prev.filter((tr) => tr.code !== code));
  }

  function handleUpdateTranslation(
    code: string,
    field: keyof AdditionalTranslation,
    value: string
  ) {
    setTranslations((prev) =>
      prev.map((tr) => (tr.code === code ? { ...tr, [field]: value } : tr))
    );
  }

  function handleToggleLocale(code: string) {
    if (selectedLocales.includes(code)) {
      if (selectedLocales.length <= 1) {
        toast.error(t("minOneLanguageActive"));
        return;
      }
      setSelectedLocales((prev) => prev.filter((c) => c !== code));
      return;
    }
    setSelectedLocales((prev) => [...prev, code]);
  }

  async function handleSave() {
    if (!defaultName.trim()) {
      toast.error(t("blogNameRequired"));
      return;
    }
    if (!domain.trim()) {
      toast.error(t("domainRequired"));
      return;
    }

    startTransition(async () => {
      let packedName = defaultName.trim();
      let packedSubtitle = defaultSubtitle.trim();
      let packedDesc = defaultDescription.trim();

      if (translations.length > 0) {
        const namesMap: Record<string, string> = { [defaultLocale]: defaultName.trim() };
        const subtitlesMap: Record<string, string> = { [defaultLocale]: defaultSubtitle.trim() };
        const descriptionsMap: Record<string, string> = { [defaultLocale]: defaultDescription.trim() };

        for (const tr of translations) {
          if (tr.name.trim()) namesMap[tr.code] = tr.name.trim();
          if (tr.subtitle.trim()) subtitlesMap[tr.code] = tr.subtitle.trim();
          if (tr.description.trim()) descriptionsMap[tr.code] = tr.description.trim();
        }

        packedName = packLocalizedMap(namesMap, defaultLocale);
        packedSubtitle = packLocalizedMap(subtitlesMap, defaultLocale);
        packedDesc = packLocalizedMap(descriptionsMap, defaultLocale);
      }

      const res = await updateSite(site.id, {
        name: packedName,
        domain: domain.trim(),
        subtitle: packedSubtitle || undefined,
        description: packedDesc || undefined,
        locale: defaultLocale,
        theme: (site.theme as "dark" | "light") || "dark",
        primaryColor: site.primaryColor || "#6366f1",
        fontFamily: site.fontFamily || "Inter",
        supportedLocales: JSON.stringify(selectedLocales),
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
    <SettingsForm
      title={t("general")}
      description={t("generalDesc")}
      icon={<Settings className="w-5 h-5 text-accent" />}
      onSave={handleSave}
      saveLabel={tc("save")}
      isPending={isPending}
      maxWidthClass="max-w-3xl"
    >
      <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-text">{t("mainDetails")}</h3>
            <p className="text-xs text-text-muted">{t("mainDetailsDesc")}</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20">
            {t("primary")} ({defaultLocale.toUpperCase()})
          </span>
        </div>

        <div className="space-y-4">
          <Input
            label={t("siteName")}
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
            placeholder={t("siteNamePlaceholder")}
            required
          />

          <Input
            label={t("siteSubtitle")}
            value={defaultSubtitle}
            onChange={(e) => setDefaultSubtitle(e.target.value)}
            placeholder={t("siteSubtitlePlaceholder")}
          />

          <Textarea
            label={t("siteDescription")}
            value={defaultDescription}
            onChange={(e) => setDefaultDescription(e.target.value)}
            placeholder={t("siteDescriptionPlaceholder")}
            className="min-h-[80px] text-xs"
          />
        </div>
      </div>

      <SiteTranslationsSection
        availableLanguages={AVAILABLE_LANGUAGES}
        unusedLanguages={unusedLanguages}
        translations={translations}
        addLangCode={addLangCode}
        defaultName={defaultName}
        defaultSubtitle={defaultSubtitle}
        defaultDescription={defaultDescription}
        onChangeAddLangCode={setAddLangCode}
        onAddTranslation={handleAddTranslation}
        onRemoveTranslation={handleRemoveTranslation}
        onUpdateTranslation={handleUpdateTranslation}
      />

      <SupportedLocalesSection
        availableLanguages={AVAILABLE_LANGUAGES}
        selectedLocales={selectedLocales}
        onToggleLocale={handleToggleLocale}
      />

      <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text">{t("domainAndLocaleParams")}</h3>
        </div>

        <div className="space-y-4">
          <Input
            label={t("domain")}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("domainPlaceholder")}
            helperText={t("domainHint")}
            required
          />

          <Select
            label={t("defaultLocale")}
            value={defaultLocale}
            onChange={(val) => {
              const normalized = normalizeLocale(val);
              setDefaultLocale(normalized);
              if (!selectedLocales.includes(normalized)) {
                setSelectedLocales((prev) => [...prev, normalized]);
              }
            }}
            options={AVAILABLE_LANGUAGES.map((lang) => ({
              value: lang.code,
              label: `${lang.flag} ${lang.label}`,
            }))}
          />
        </div>
      </div>
    </SettingsForm>
  );
}
