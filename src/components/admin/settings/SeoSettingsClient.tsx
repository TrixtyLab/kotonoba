"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { Search, Save, Sparkles, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the SeoSettingsClient component.
 */
export interface SeoSettingsClientProps {
  /** Target site ID. */
  siteId: string;
  /** Key-value dictionary of existing site settings. */
  initialSettings: Record<string, string>;
  /** Flag indicating whether the Dub.co link shortening service is active. */
  isDubConfigured: boolean;
}

/**
 * Administrative SEO and LLM index management panel for configuring custom LLMs.txt files and search engine parameters.
 *
 * @param props - SeoSettingsClientProps configuring site ID and current SEO parameters.
 * @returns React JSX SEO settings view.
 */
export function SeoSettingsClient({ siteId, initialSettings, isDubConfigured }: SeoSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [llmsTxtEnabled, setLlmsTxtEnabled] = useState(initialSettings.llms_txt_enabled !== "false");
  const [llmsTxtCustom, setLlmsTxtCustom] = useState(initialSettings.llms_txt_custom || "");

  async function handleSave() {
    startTransition(async () => {
      const res = await saveSiteSettings(siteId, {
        llms_txt_enabled: llmsTxtEnabled ? "true" : "false",
        llms_txt_custom: llmsTxtCustom,
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
          <Search className="w-5 h-5 text-accent" />
          <span>{t("seo")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("seoDesc")}</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* LLMs.txt Configuration */}
        <div className="p-5 bg-surface-hover/30 border border-border rounded-xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>{t("enableLlmsTxt")}</span>
            </h3>
            <p className="text-xs text-text-muted">
              Genera automáticamente los archivos estándar <code className="bg-surface px-1 py-0.5 rounded border border-border">/llms.txt</code> y <code className="bg-surface px-1 py-0.5 rounded border border-border">/llms-full.txt</code> para que agentes de IA (ChatGPT, Claude, Perplexity) comprendan e indexen tus publicaciones.
            </p>
          </div>

          <Checkbox
            checked={llmsTxtEnabled}
            onChange={(val) => setLlmsTxtEnabled(val)}
            label={t("enableLlmsTxt")}
          />

          {llmsTxtEnabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Textarea
                label={t("llmsTxtDescription")}
                value={llmsTxtCustom}
                onChange={(e) => setLlmsTxtCustom(e.target.value)}
                placeholder="Instrucciones adicionales para agentes de IA que consulten este blog…"
                className="min-h-[100px] text-xs font-mono"
              />
            </div>
          )}
        </div>

        {/* Dub.co Status Card */}
        <div className="p-5 bg-surface-hover/30 border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <span>{t("dubIntegration")}</span>
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isDubConfigured
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              {isDubConfigured ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {isDubConfigured ? "Activo" : "No Configurado"}
            </span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            {isDubConfigured ? t("dubConfigured") : t("dubNotConfigured")}
          </p>

          <a
            href="https://dub.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-semibold"
          >
            <span>Conocer más sobre Dub.co</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
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
    </div>
  );
}
