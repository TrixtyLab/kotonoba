"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FolderPlus,
  Globe,
  Laptop,
  Moon,
  Palette,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { SetupWizardData } from "@/lib/services/setup";

function swatchNeedsDarkInk(hex: string): boolean {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return false;
  const value = Number.parseInt(raw, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/** Color preset options shown in Step 3 of the setup wizard. */
const SETUP_COLOR_PRESETS = [
  { hex: "#6366f1", nameKey: "colorIndigo" },
  { hex: "#3b82f6", nameKey: "colorBlue" },
  { hex: "#10b981", nameKey: "colorEmerald" },
  { hex: "#8b5cf6", nameKey: "colorPurple" },
  { hex: "#ec4899", nameKey: "colorPink" },
  { hex: "#f59e0b", nameKey: "colorAmber" },
] as const;

/** Props for {@link SetupStepPanels}. */
export interface SetupStepPanelsProps {
  step: number;
  formData: SetupWizardData;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  cleanDomainPreview: string;
  onUpdateField: <K extends keyof SetupWizardData>(field: K, val: SetupWizardData[K]) => void;
  onGoToDashboard: () => void;
  onViewPublicBlog: () => void;
}

/**
 * Renders the active onboarding step body (Steps 1–5) for {@link SetupWizardClient}.
 */
export function SetupStepPanels({
  step,
  formData,
  showPassword,
  onToggleShowPassword,
  cleanDomainPreview,
  onUpdateField,
  onGoToDashboard,
  onViewPublicBlog,
}: SetupStepPanelsProps) {
  const t = useTranslations("setup");
  const tc = useTranslations("common");

  if (step === 1) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="border-b border-border/60 pb-2.5">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            {t("step1_heading")}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{t("step1_description")}</p>
        </div>

        <div className="space-y-3 pt-1">
          <Input
            id="setup-admin-name"
            label={t("fullName")}
            placeholder={t("fullNamePlaceholder")}
            value={formData.adminName}
            onChange={(e) => onUpdateField("adminName", e.target.value)}
            autoComplete="name"
            autoFocus
          />

          <Input
            id="setup-admin-email"
            type="email"
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            value={formData.adminEmail}
            onChange={(e) => onUpdateField("adminEmail", e.target.value)}
            autoComplete="email"
          />

          <Input
            id="setup-admin-password"
            type={showPassword ? "text" : "password"}
            label={t("password")}
            helperText={t("passwordMinHint")}
            placeholder={t("passwordPlaceholder")}
            value={formData.adminPassword}
            onChange={(e) => onUpdateField("adminPassword", e.target.value)}
            autoComplete="new-password"
            endAdornment={
              <button
                type="button"
                onClick={onToggleShowPassword}
                aria-label={showPassword ? tc("hidePassword") : tc("showPassword")}
                className="w-9 h-9 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="border-b border-border/60 pb-2.5">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            {t("step2_heading")}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{t("step2_description")}</p>
        </div>

        <div className="space-y-3 pt-1">
          <Input
            id="setup-site-name"
            label={t("blogName")}
            placeholder={t("blogNamePlaceholder")}
            value={formData.siteName}
            onChange={(e) => onUpdateField("siteName", e.target.value)}
            autoFocus
          />

          <Input
            id="setup-site-subtitle"
            label={t("blogSubtitle")}
            placeholder={t("blogSubtitlePlaceholder")}
            value={formData.siteSubtitle}
            onChange={(e) => onUpdateField("siteSubtitle", e.target.value)}
          />

          <div>
            <Input
              id="setup-domain"
              label={t("domain")}
              placeholder={t("domainPlaceholder")}
              value={formData.domain}
              onChange={(e) => onUpdateField("domain", e.target.value)}
            />
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
              <span>{t("canonicalUrl")}</span>
              <span className="font-mono text-accent font-semibold px-1.5 py-0.5 bg-accent/10 rounded-sm border border-accent/20">
                {cleanDomainPreview.includes("localhost")
                  ? `http://${cleanDomainPreview}`
                  : `https://${cleanDomainPreview}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="border-b border-border/60 pb-2.5">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            {t("step3_heading")}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{t("step3_description")}</p>
        </div>

        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-text mb-2">{t("accentColor")}</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SETUP_COLOR_PRESETS.map((preset) => {
                const isSelected = formData.primaryColor === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onUpdateField("primaryColor", preset.hex)}
                    aria-pressed={isSelected}
                    className={`p-2 min-h-[64px] rounded-md border flex flex-col items-center justify-center gap-1 transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/10 font-bold"
                        : "border-border bg-surface-hover/30 hover:border-text-muted hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-sm flex items-center justify-center ${
                        swatchNeedsDarkInk(preset.hex) ? "text-slate-950" : "text-white"
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </span>
                    <span className="text-xs text-text truncate">{t(preset.nameKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-2">{t("defaultTheme")}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateField("theme", "dark")}
                aria-pressed={formData.theme === "dark"}
                className={`p-3 min-h-[64px] rounded-md border flex items-center gap-3 transition-colors text-left ${
                  formData.theme === "dark"
                    ? "border-accent bg-accent/10 text-accent font-bold"
                    : "border-border bg-surface-hover/30 text-text-muted hover:text-text hover:border-text-muted"
                }`}
              >
                <div className="w-8 h-8 rounded-sm bg-slate-900 border border-slate-700 flex items-center justify-center text-accent shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text">{t("darkTheme")}</p>
                  <p className="text-xs text-text-muted">{t("darkThemeHint")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateField("theme", "light")}
                aria-pressed={formData.theme === "light"}
                className={`p-3 min-h-[64px] rounded-md border flex items-center gap-3 transition-colors text-left ${
                  formData.theme === "light"
                    ? "border-accent bg-accent/10 text-accent font-bold"
                    : "border-border bg-surface-hover/30 text-text-muted hover:text-text hover:border-text-muted"
                }`}
              >
                <div className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-300 flex items-center justify-center text-amber-500 shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text">{t("lightTheme")}</p>
                  <p className="text-xs text-text-muted">{t("lightThemeHint")}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="border-b border-border/60 pb-2.5">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-accent" />
            {t("step4_heading")}
          </h2>
          <p className="text-sm text-text-muted mt-0.5">{t("step4_description")}</p>
        </div>

        <div className="space-y-3 pt-1">
          <Input
            id="setup-category"
            label={t("categoryName")}
            placeholder={t("categoryNamePlaceholder")}
            value={formData.categoryName}
            onChange={(e) => onUpdateField("categoryName", e.target.value)}
            autoFocus
          />

          <div className="p-3.5 rounded-md bg-surface-hover/40 border border-border text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-text">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>{t("starterSeedTitle")}</span>
            </div>
            <p className="text-text-muted leading-relaxed text-sm">{t("starterSeedDescription")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center py-3 animate-fade-in">
      <div className="w-12 h-12 bg-primary text-bg rounded-md flex items-center justify-center mx-auto">
        <Sparkles className="w-6 h-6" />
      </div>

      <div className="space-y-1 max-w-md mx-auto">
        <h2 className="text-lg font-bold text-text tracking-tight">{t("step5_heading")}</h2>
        <p className="text-sm text-text-muted leading-relaxed">
          {t("step5_description", { siteName: formData.siteName })}
        </p>
      </div>

      <div className="p-3.5 rounded-md bg-surface-hover/30 border border-border text-sm text-left max-w-md mx-auto grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-text-muted font-medium block">{t("summaryAdmin")}</span>
          <span className="font-medium text-text truncate block">{formData.adminEmail}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted font-medium block">{t("summaryDomain")}</span>
          <span className="font-mono text-accent font-semibold truncate block">{cleanDomainPreview}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted font-medium block">{t("summaryTheme")}</span>
          <span className="font-medium text-text capitalize block">{formData.theme}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted font-medium block">{t("summaryCategory")}</span>
          <span className="font-medium text-text block">{formData.categoryName}</span>
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
        <Button
          variant="primary"
          size="sm"
          onClick={onGoToDashboard}
          icon={<ArrowRight className="w-3.5 h-3.5" />}
          iconPosition="end"
        >
          {t("goToDashboard")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewPublicBlog}
          icon={<Laptop className="w-3.5 h-3.5" />}
        >
          {t("viewPublicBlog")}
        </Button>
      </div>
    </div>
  );
}
