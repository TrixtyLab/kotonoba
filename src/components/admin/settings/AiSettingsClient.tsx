"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveAiSettings, testAiConnection } from "@/actions/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { Sparkles, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the AiSettingsClient component.
 */
export interface AiSettingsClientProps {
  /** Target site ID. */
  siteId: string;
  /** Key-value dictionary of existing AI model settings. */
  initialSettings: Record<string, string>;
}

/**
 * Administrative AI assistant configuration interface for setting OpenAI-compatible endpoints, models, temperatures, and testing API credentials.
 *
 * @param props - AiSettingsClientProps configuring site ID and current AI settings.
 * @returns React JSX AI settings view.
 */
export function AiSettingsClient({ siteId, initialSettings }: AiSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [aiEnabled, setAiEnabled] = useState(initialSettings.ai_enabled === "true");
  const [aiUrl, setAiUrl] = useState(initialSettings.ai_api_url || "https://api.openai.com/v1");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState(initialSettings.ai_model || "gpt-4o");
  const [aiTemperature, setAiTemperature] = useState(parseFloat(initialSettings.ai_temperature || "0.7"));

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  async function handleTestConnection() {
    if (!aiKey) {
      toast.error("Ingresa la clave de API para probar la conexión");
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await testAiConnection(aiUrl, aiKey, aiModel);

      if (res.success) {
        setTestResult({
          success: true,
          message: t("aiConnectionSuccess"),
        });
        toast.success(t("aiConnectionSuccess"));
      } else {
        setTestResult({
          success: false,
          message: res.error || t("aiConnectionFailed"),
        });
        toast.error(res.error || t("aiConnectionFailed"));
      }
    } catch {
      setTestResult({
        success: false,
        message: t("aiConnectionFailed"),
      });
      toast.error(t("aiConnectionFailed"));
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSave() {
    startTransition(async () => {
      const res = await saveAiSettings(siteId, {
        enabled: aiEnabled,
        apiUrl: aiUrl,
        apiKey: aiKey || undefined,
        model: aiModel,
        temperature: aiTemperature,
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
          <Sparkles className="w-5 h-5 text-accent" />
          <span>{t("ai")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("aiDesc")}</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        <Checkbox
          checked={aiEnabled}
          onChange={(val) => setAiEnabled(val)}
          label={t("aiEnabled")}
        />

        <div className="space-y-4 pt-2 border-t border-border">
          <Input
            label={t("aiEndpoint")}
            value={aiUrl}
            onChange={(e) => setAiUrl(e.target.value)}
            placeholder={t("aiEndpointPlaceholder")}
            required
          />

          <Input
            label={t("aiApiKey")}
            type="password"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder={initialSettings.ai_api_key ? "•••••••••••••••• (dejar en blanco para mantener actual)" : "sk-..."}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("aiModel")}
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={t("aiModelPlaceholder")}
              required
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text">{t("aiTemperature")}</label>
                <span className="text-xs font-mono text-text-muted">{aiTemperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={aiTemperature}
                onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testLoading}
              icon={testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              {testLoading ? "Probando conexión..." : t("aiTestConnection")}
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-500"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <p className="leading-relaxed font-medium">{testResult.message}</p>
            </div>
          )}
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
