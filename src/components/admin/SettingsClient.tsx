"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings, saveAiSettings, testAiConnection } from "@/actions/settings";
import { updateSite } from "@/actions/sites";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  Settings, Palette, Search, Sparkles,
  CheckCircle2, AlertCircle, RefreshCw,
  Archive, Download, Upload, AlertTriangle, FileArchive
} from "lucide-react";

export interface SettingsClientProps {
  site: {
    id: string;
    name: string;
    domain: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    locale: string;
    theme: "dark" | "light";
    primaryColor?: string | null;
    fontFamily?: string | null;
  };
  initialSettings: Record<string, string>;
}

/**
 * Site configuration dashboard enabling UI customization, SEO tweaks,
 * AI endpoints, and complete ZIP backup export/import disaster recovery.
 */
export function SettingsClient({ site, initialSettings }: SettingsClientProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "seo" | "ai" | "backup">("general");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [siteName, setSiteName] = useState(site.name);
  const [domain, setDomain] = useState(site.domain);
  const [subtitle, setSubtitle] = useState(site.subtitle || "");
  const [description, setDescription] = useState(site.description || "");

  const [primaryColor, setPrimaryColor] = useState(site.primaryColor || "#6366f1");
  const [theme, setTheme] = useState<"dark" | "light">(site.theme || "dark");
  const [logoUrl, setLogoUrl] = useState(site.logoUrl || "");
  const [faviconUrl, setFaviconUrl] = useState(site.faviconUrl || "");

  const [llmsTxtEnabled, setLlmsTxtEnabled] = useState(initialSettings.llms_txt_enabled !== "false");

  const [aiEnabled, setAiEnabled] = useState(initialSettings.ai_enabled === "true");
  const [aiUrl, setAiUrl] = useState(initialSettings.ai_api_url || "https://api.openai.com/v1");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState(initialSettings.ai_model || "gpt-4o");
  const [aiTemperature, setAiTemperature] = useState(parseFloat(initialSettings.ai_temperature || "0.7"));
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Backup & Restore State
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSaveGeneral() {
    startTransition(async () => {
      const res = await updateSite(site.id, {
        name: siteName,
        domain,
        subtitle,
        description,
        locale: site.locale,
        theme,
        primaryColor,
        fontFamily: site.fontFamily || "Inter",
      });

      if (res.success) {
        setFeedback({ type: "success", message: t("saveSuccess") });
      } else {
        setFeedback({ type: "error", message: "Failed to save settings." });
      }
    });
  }

  async function handleSaveBranding() {
    startTransition(async () => {
      await updateSite(site.id, {
        name: siteName,
        domain,
        subtitle,
        description,
        locale: site.locale,
        theme,
        primaryColor,
        fontFamily: site.fontFamily || "Inter",
      });
      await saveSiteSettings(site.id, {
        logo_url: logoUrl,
        favicon_url: faviconUrl,
      });
      setFeedback({ type: "success", message: t("saveSuccess") });
    });
  }

  async function handleSaveSeo() {
    startTransition(async () => {
      await saveSiteSettings(site.id, {
        llms_txt_enabled: String(llmsTxtEnabled),
      });
      setFeedback({ type: "success", message: t("saveSuccess") });
    });
  }

  async function handleSaveAi() {
    startTransition(async () => {
      const res = await saveAiSettings(site.id, {
        apiUrl: aiUrl,
        apiKey: aiKey,
        model: aiModel,
        temperature: aiTemperature,
        enabled: aiEnabled,
      });
      if (res.success) {
        setFeedback({ type: "success", message: t("saveSuccess") });
        setAiKey("");
      } else {
        setFeedback({ type: "error", message: "Failed to save AI configuration." });
      }
    });
  }

  async function handleTestAi() {
    if (!aiUrl) {
      setTestResult({ success: false, message: "Please specify an API base URL." });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    const res = await testAiConnection(aiUrl, aiKey || initialSettings.ai_api_key_masked, aiModel);
    setTestLoading(false);
    if (res.success) {
      setTestResult({ success: true, message: `Ping success! Response: ${res.reply || "OK"}` });
    } else {
      setTestResult({ success: false, message: res.error || "Connection test failed." });
    }
  }

  async function handleDownloadBackup() {
    try {
      setIsExporting(true);
      setBackupFeedback(null);
      const res = await fetch(`/api/backup/export?siteId=${encodeURIComponent(site.id)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = `backup-${site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export backup";
      setBackupFeedback({ type: "error", message });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportBackup() {
    if (!importFile) {
      setBackupFeedback({ type: "error", message: t("noFileSelected") });
      return;
    }

    if (importMode === "replace") {
      const confirmed = confirm(t("replaceWarning"));
      if (!confirmed) return;
    }

    try {
      setIsImporting(true);
      setBackupFeedback(null);

      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("siteId", site.id);
      formData.append("mode", importMode);

      const res = await fetch("/api/backup/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Import failed");
      }

      const stats = data.stats || {};
      const successMessage = t("restoreSuccess", {
        posts: stats.posts ?? 0,
        categories: stats.categories ?? 0,
        tags: stats.tags ?? 0,
        settings: stats.settings ?? 0,
        media: stats.media ?? 0,
      });

      setBackupFeedback({ type: "success", message: successMessage });
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import backup";
      setBackupFeedback({ type: "error", message: t("restoreError", { error: message }) });
    } finally {
      setIsImporting(false);
    }
  }

  const tabs = [
    { id: "general", label: t("general"), icon: Settings },
    { id: "branding", label: t("branding"), icon: Palette },
    { id: "seo", label: t("seo"), icon: Search },
    { id: "ai", label: t("ai"), icon: Sparkles },
    { id: "backup", label: t("backup"), icon: Archive },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text tracking-tight">{t("title")}</h1>
        <p className="text-xs text-text-muted">{t("backupDesc")}</p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between animate-slide-down ${
            feedback.type === "success"
              ? "bg-success/15 text-success border border-success/30"
              : "bg-danger/15 text-danger border border-danger/30"
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="flex border-b border-border gap-2 overflow-x-auto">
        {tabs.map((tItem) => {
          const Icon = tItem.icon;
          const active = activeTab === tItem.id;
          return (
            <button
              key={tItem.id}
              onClick={() => setActiveTab(tItem.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tItem.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "general" && (
        <div className="glass p-6 rounded-xl border border-border space-y-4 animate-fade-in">
          <Input
            label={t("siteName")}
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
          <Input
            label={tCommon("sites")}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            helperText="Matches the incoming HTTP Host header for multi-tenancy routing"
          />
          <Input
            label={t("siteSubtitle")}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <Textarea
            label={t("siteDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Default description for search engine result snippets and social previews"
          />
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveGeneral} loading={isPending}>
              {tCommon("save")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "branding" && (
        <div className="glass p-6 rounded-xl border border-border space-y-6 animate-fade-in">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              {t("primaryColor")}
            </label>
            <div className="flex items-center gap-3">
              {["#6366f1", "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrimaryColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-transform btn-press ${
                    primaryColor === c ? "ring-4 ring-white/40 scale-110 shadow-lg" : "opacity-80 hover:opacity-100"
                  }`}
                />
              ))}
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("logoUrl")}
              placeholder="https://... logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <Input
              label={t("faviconUrl")}
              placeholder="https://... favicon.ico"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              {tCommon("themeDark")} / {tCommon("themeLight")}
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                  theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
                }`}
              >
                {tCommon("themeDark")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                  theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border text-text-muted"
                }`}
              >
                {tCommon("themeLight")}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveBranding} loading={isPending}>
              {tCommon("save")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "seo" && (
        <div className="glass p-6 rounded-xl border border-border space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div>
              <h3 className="text-sm font-bold text-text">{t("llmsTxtDescription")}</h3>
              <p className="text-xs text-text-muted">
                Provides a curated markdown manifest for Perplexity, ChatGPT, Claude, and Gemini crawlers.
              </p>
            </div>
            <input
              type="checkbox"
              checked={llmsTxtEnabled}
              onChange={(e) => setLlmsTxtEnabled(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="space-y-2 text-xs text-text-muted">
            <p className="font-semibold text-text">Active Endpoints:</p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
              <li><a href="/sitemap.xml" target="_blank" className="text-primary hover:underline">/sitemap.xml</a> — XML sitemap with multi-language hreflang alternates</li>
              <li><a href="/robots.txt" target="_blank" className="text-primary hover:underline">/robots.txt</a> — Search bot crawl control rules</li>
              <li><a href="/llms.txt" target="_blank" className="text-primary hover:underline">/llms.txt</a> — AI agent index</li>
              <li><a href="/llms-full.txt" target="_blank" className="text-primary hover:underline">/llms-full.txt</a> — Full markdown catalog for model context</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleSaveSeo} loading={isPending}>
              {tCommon("save")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "ai" && (
        <div className="glass p-6 rounded-xl border border-border space-y-5 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{t("ai")}</span>
              </h3>
              <p className="text-xs text-text-muted">
                Connect OpenAI, Ollama (localhost), LM Studio, Groq, Azure, or any OpenAI-compatible API for editor assistance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-text cursor-pointer">
                {aiEnabled ? "Enabled" : "Disabled"}
              </label>
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          <Input
            label={t("aiEndpoint")}
            placeholder={t("aiEndpointPlaceholder")}
            value={aiUrl}
            onChange={(e) => setAiUrl(e.target.value)}
            helperText="Works with any server implementing the standard /chat/completions endpoint"
          />

          <div className="space-y-1">
            <Input
              label={t("aiApiKey")}
              type="password"
              placeholder={initialSettings.ai_api_key_masked ? `Masked (${initialSettings.ai_api_key_masked}) — enter new key to replace` : "sk-..."}
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              helperText="Encrypted using AES-256 in the database. Never sent to client browsers."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("aiModel")}
              placeholder={t("aiModelPlaceholder")}
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t("aiTemperature")} ({aiTemperature})
                </label>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={aiTemperature}
                onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                testResult.success
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTestAi}
              loading={testLoading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {t("aiTestConnection")}
            </Button>

            <Button variant="primary" onClick={handleSaveAi} loading={isPending}>
              {tCommon("save")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "backup" && (
        <div className="space-y-6 animate-fade-in">
          {backupFeedback && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between animate-slide-down ${
                backupFeedback.type === "success"
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {backupFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{backupFeedback.message}</span>
              </div>
              <button onClick={() => setBackupFeedback(null)} className="ml-4 hover:opacity-80">✕</button>
            </div>
          )}

          {/* Export Card */}
          <div className="glass p-6 rounded-xl border border-border space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary font-bold text-base">
                  <Download className="w-5 h-5" />
                  <h3>{t("exportBackup")}</h3>
                </div>
                <p className="text-xs text-text-muted">
                  {t("exportBackupDesc")}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-surface/50 border border-border/50 text-xs text-text-muted space-y-2">
              <p className="font-semibold text-text">Archive contents:</p>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 list-none text-[11px] font-mono">
                <li className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-primary" /> manifest.json</li>
                <li className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-primary" /> data.json (DB dump)</li>
                <li className="flex items-center gap-1.5"><FileArchive className="w-3.5 h-3.5 text-primary" /> uploads/* (Images & Media)</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={handleDownloadBackup}
                loading={isExporting}
                icon={<Download className="w-4 h-4" />}
              >
                {isExporting ? t("downloadingBackup") : t("downloadBackupBtn")}
              </Button>
            </div>
          </div>

          {/* Import Card */}
          <div className="glass p-6 rounded-xl border border-border space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-secondary font-bold text-base">
                  <Upload className="w-5 h-5" />
                  <h3>{t("importBackup")}</h3>
                </div>
                <p className="text-xs text-text-muted">
                  {t("importBackupDesc")}
                </p>
              </div>
            </div>

            {/* File Dropzone / Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                ZIP Archive File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  importFile
                    ? "border-primary/60 bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40 bg-surface/30 hover:bg-surface/50 text-text-muted"
                }`}
              >
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <Archive className="w-8 h-8 text-primary/80" />
                  {importFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-text">
                        {t("fileSelected", {
                          name: importFile.name,
                          size: `${(importFile.size / 1024 / 1024).toFixed(2)} MB`,
                        })}
                      </p>
                      <p className="text-[11px] text-primary">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text">{t("selectBackupFile")}</p>
                      <p className="text-[11px] text-text-muted">Supported format: .zip containing manifest.json and data.json</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mode Strategy Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("restoreMode")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setImportMode("merge")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    importMode === "merge"
                      ? "border-primary bg-primary/10 text-text ring-1 ring-primary"
                      : "border-border bg-surface/30 text-text-muted hover:text-text hover:bg-surface/50"
                  }`}
                >
                  <p className="text-xs font-bold text-text mb-1">Merge Content</p>
                  <p className="text-[11px] text-text-muted">
                    {t("modeMerge")}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode("replace")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    importMode === "replace"
                      ? "border-danger bg-danger/10 text-text ring-1 ring-danger"
                      : "border-border bg-surface/30 text-text-muted hover:text-text hover:bg-surface/50"
                  }`}
                >
                  <p className="text-xs font-bold text-danger mb-1">Replace Everything</p>
                  <p className="text-[11px] text-text-muted">
                    {t("modeReplace")}
                  </p>
                </button>
              </div>

              {importMode === "replace" && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t("replaceWarning")}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border/50">
              <Button
                variant={importMode === "replace" ? "danger" : "primary"}
                onClick={handleImportBackup}
                loading={isImporting}
                disabled={!importFile}
                icon={<Upload className="w-4 h-4" />}
              >
                {isImporting ? t("restoring") : t("startRestoreBtn")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
