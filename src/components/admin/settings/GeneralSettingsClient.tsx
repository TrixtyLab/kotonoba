"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateSite } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Save, Settings, Plus, Trash2, Globe, CheckCircle2 } from "lucide-react";
import { useRouter, LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/routing";
import { getLocalizedText, getLocalizedMap, packLocalizedMap } from "@/lib/utils/localization";

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
  ja: "🇯🇵",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇵🇹",
  it: "🇮🇹",
  zh: "🇨🇳",
  ko: "🇰🇷",
};

/**
 * List of site-supported languages dynamically derived from application routing.
 */
export const AVAILABLE_LANGUAGES = LOCALES.map((code) => ({
  code,
  label: `${LOCALE_NAMES[code as Locale] || code} (${code.toUpperCase()})`,
  flag: LOCALE_FLAGS[code] || "🌐",
}));

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
    supportedLocales?: string | null;
  };
}

interface AdditionalTranslation {
  code: string;
  name: string;
  subtitle: string;
  description: string;
}

/**
 * Administrative panel view for managing general site attributes with a default details section,
 * optional multilingual translation cards, and checkboxes for selecting enabled blog languages.
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

  const initialDefaultLocale = site.locale || "en";
  const [defaultLocale, setDefaultLocale] = useState(initialDefaultLocale);

  const [defaultName, setDefaultName] = useState(() =>
    getLocalizedText(site.name, initialDefaultLocale)
  );
  const [defaultSubtitle, setDefaultSubtitle] = useState(() =>
    getLocalizedText(site.subtitle, initialDefaultLocale)
  );
  const [defaultDescription, setDefaultDescription] = useState(() =>
    getLocalizedText(site.description, initialDefaultLocale)
  );

  const [translations, setTranslations] = useState<AdditionalTranslation[]>(() => {
    const rawNames = getLocalizedMap(site.name, []);
    const rawSubtitles = getLocalizedMap(site.subtitle, []);
    const rawDescriptions = getLocalizedMap(site.description, []);

    const list: AdditionalTranslation[] = [];
    const keys = Array.from(new Set([
      ...Object.keys(rawNames),
      ...Object.keys(rawSubtitles),
      ...Object.keys(rawDescriptions),
    ]));

    for (const key of keys) {
      if (key !== initialDefaultLocale && (rawNames[key] || rawSubtitles[key] || rawDescriptions[key])) {
        list.push({
          code: key,
          name: rawNames[key] || "",
          subtitle: rawSubtitles[key] || "",
          description: rawDescriptions[key] || "",
        });
      }
    }
    return list;
  });

  const [selectedLocales, setSelectedLocales] = useState<string[]>(() => {
    if (site.supportedLocales) {
      try {
        const parsed = JSON.parse(site.supportedLocales);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Continue on invalid json
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
    if (!addLangCode) return;
    const existing = translations.find((tr) => tr.code === addLangCode);
    if (existing) return;

    setTranslations((prev) => [
      ...prev,
      {
        code: addLangCode,
        name: "",
        subtitle: "",
        description: "",
      },
    ]);
    setAddLangCode("");
  }

  function handleRemoveTranslation(code: string) {
    setTranslations((prev) => prev.filter((tr) => tr.code !== code));
  }

  function handleUpdateTranslation(code: string, field: keyof AdditionalTranslation, value: string) {
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
    } else {
      setSelectedLocales((prev) => [...prev, code]);
    }
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
    <div className="space-y-6 max-w-3xl">
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent" />
          <span>{t("general")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("generalDesc")}</p>
      </div>

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
            placeholder="KagariSoft"
            required
          />

          <Input
            label={t("siteSubtitle")}
            value={defaultSubtitle}
            onChange={(e) => setDefaultSubtitle(e.target.value)}
            placeholder="Official Blog"
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

      <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-text">{t("additionalTranslations")}</h3>
            <p className="text-xs text-text-muted">{t("additionalTranslationsDesc")}</p>
          </div>

          {unusedLanguages.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-56">
                <Select
                  value={addLangCode}
                  onChange={(val) => setAddLangCode(val)}
                  options={unusedLanguages.map((lang) => ({
                    value: lang.code,
                    label: `${lang.flag} ${lang.label}`,
                  }))}
                  placeholder={t("selectLanguagePlaceholder")}
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAddTranslation}
                disabled={!addLangCode}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs shrink-0"
              >
                {tc("add")}
              </Button>
            </div>
          )}
        </div>

        {translations.length === 0 ? (
          <div className="py-4 text-center text-xs text-text-muted border border-dashed border-border rounded-lg bg-surface-hover/20">
            {t("noAdditionalTranslations")}
          </div>
        ) : (
          <div className="space-y-4">
            {translations.map((tr) => {
              const langInfo = AVAILABLE_LANGUAGES.find((l) => l.code === tr.code);
              return (
                <div
                  key={tr.code}
                  className="p-4 bg-surface-hover/40 border border-border rounded-xl space-y-3 relative group animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                      <span className="text-base">{langInfo?.flag}</span>
                      {langInfo?.label || tr.code.toUpperCase()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveTranslation(tr.code)}
                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title={t("deleteTranslation")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      label={`${t("siteName")} (${tr.code.toUpperCase()})`}
                      value={tr.name}
                      onChange={(e) => handleUpdateTranslation(tr.code, "name", e.target.value)}
                      placeholder={defaultName || t("translatedNamePlaceholder")}
                    />

                    <Input
                      label={`${t("siteSubtitle")} (${tr.code.toUpperCase()})`}
                      value={tr.subtitle}
                      onChange={(e) => handleUpdateTranslation(tr.code, "subtitle", e.target.value)}
                      placeholder={defaultSubtitle || t("translatedSubtitlePlaceholder")}
                    />

                    <Textarea
                      label={`${t("siteDescription")} (${tr.code.toUpperCase()})`}
                      value={tr.description}
                      onChange={(e) => handleUpdateTranslation(tr.code, "description", e.target.value)}
                      placeholder={defaultDescription || t("translatedDescPlaceholder")}
                      className="min-h-[70px] text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <span>{t("visibleLanguages")}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {t("visibleLanguagesDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {AVAILABLE_LANGUAGES.map((lang) => {
            const isChecked = selectedLocales.includes(lang.code);
            return (
              <label
                key={lang.code}
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  isChecked
                    ? "border-accent bg-accent/5 text-text shadow-2xs"
                    : "border-border bg-surface-hover/20 text-text-muted hover:border-border-hover hover:text-text"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleLocale(lang.code)}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                />
                <span className="text-base leading-none">{lang.flag}</span>
                <span className="text-xs font-medium flex-1">{lang.label}</span>
                {lang.code === "en" && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                    {tc("default")}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {selectedLocales.length === 1 && (
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2 text-xs text-accent">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t("onlyOneLanguageActive", { lang: AVAILABLE_LANGUAGES.find((l) => l.code === selectedLocales[0])?.label || "English" })}</span>
          </div>
        )}
      </div>

      <div className="p-5 bg-surface border border-border rounded-xl space-y-4 shadow-xs">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text">{t("domainAndLocaleParams")}</h3>
        </div>

        <div className="space-y-4">
          <Input
            label={t("domain")}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="blog.domain.com"
            helperText={t("domainHint")}
            required
          />

          <Select
            label={t("defaultLocale")}
            value={defaultLocale}
            onChange={(val) => {
              setDefaultLocale(val);
              if (!selectedLocales.includes(val)) {
                setSelectedLocales((prev) => [...prev, val]);
              }
            }}
            options={AVAILABLE_LANGUAGES.map((lang) => ({
              value: lang.code,
              label: `${lang.flag} ${lang.label}`,
            }))}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2 flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isPending}
          icon={<Save className="w-4 h-4" />}
          className="text-xs px-6 py-2"
        >
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
