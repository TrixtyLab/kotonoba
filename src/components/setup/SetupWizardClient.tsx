"use client";

import React, { useState, useTransition } from "react";
import { completeSetupWizard, type SetupWizardData } from "@/actions/setup";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations, useLocale } from "next-intl";
import {
  ShieldCheck,
  Globe,
  Palette,
  FolderPlus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Check,
  Laptop
} from "lucide-react";

/**
 * Guided multi-step onboarding wizard for bootstrapping the administrator account, initial blog site, and initial taxonomy structure.
 * Clean, flat, modern architecture with zero rounded bubble containers or heavy shadows.
 *
 * @returns React JSX setup wizard interface.
 */
export function SetupWizardClient() {
  const t = useTranslations("setup");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<SetupWizardData>({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    siteName: t("blogNamePlaceholder"),
    siteSubtitle: t("blogSubtitlePlaceholder"),
    domain: "localhost:3000",
    locale: locale || "es",
    theme: "dark",
    primaryColor: "#6366f1",
    fontFamily: "Inter",
    categoryName: "General",
  });

  const colorPresets = [
    { hex: "#6366f1", nameKey: "colorIndigo" },
    { hex: "#3b82f6", nameKey: "colorBlue" },
    { hex: "#10b981", nameKey: "colorEmerald" },
    { hex: "#8b5cf6", nameKey: "colorPurple" },
    { hex: "#ec4899", nameKey: "colorPink" },
    { hex: "#f59e0b", nameKey: "colorAmber" },
  ] as const;

  function updateField<K extends keyof SetupWizardData>(field: K, val: SetupWizardData[K]) {
    setFormData((prev) => ({ ...prev, [field]: val }));
  }

  function validateStep(currentStep: number): boolean {
    setError(null);
    if (currentStep === 1) {
      if (!formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword.trim()) {
        setError(t("errorRequiredAdmin"));
        return false;
      }
      if (!formData.adminEmail.includes("@") || !formData.adminEmail.includes(".")) {
        setError(t("errorInvalidEmail"));
        return false;
      }
      if (formData.adminPassword.length < 8) {
        setError(t("errorPasswordLength"));
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.siteName.trim()) {
        setError(t("errorBlogName"));
        return false;
      }
      if (!formData.domain.trim()) {
        setError(t("errorDomain"));
        return false;
      }
    }
    if (currentStep === 4) {
      if (!formData.categoryName.trim()) {
        setError(t("errorCategory"));
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  }

  function handlePrev() {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleComplete() {
    if (!validateStep(4)) return;
    startTransition(async () => {
      const res = await completeSetupWizard({
        ...formData,
        locale: locale || formData.locale || "es",
      });
      if (res.success) {
        setStep(5);
      } else {
        setError(res.error || t("errorGeneric"));
      }
    });
  }

  const steps = [
    { num: 1, label: t("step1_label"), title: t("step1_title"), icon: ShieldCheck },
    { num: 2, label: t("step2_label"), title: t("step2_title"), icon: Globe },
    { num: 3, label: t("step3_label"), title: t("step3_title"), icon: Palette },
    { num: 4, label: t("step4_label"), title: t("step4_title"), icon: FolderPlus },
    { num: 5, label: t("step5_label"), title: t("step5_title"), icon: CheckCircle2 },
  ];

  const cleanDomainPreview = formData.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "localhost:3000";

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-bg relative select-none">
      {/* Top Floating Controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      {/* Main Wizard Container Box */}
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center">
            <img
              src="/icon.svg"
              alt={t("title")}
              className="w-10 h-10 object-contain transition-transform duration-200 hover:scale-105"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-text">{t("title")}</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-accent/10 border border-accent/20 text-accent">
                {t("badge")}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Clean Flat Structured Card */}
        <div className="bg-surface rounded-lg p-6 sm:p-8 border border-border space-y-6">
          {/* Multi-step Timeline Stepper */}
          <div className="relative px-2 sm:px-4">
            <div className="absolute left-6 right-6 top-4 sm:top-5 -translate-y-1/2 h-0.5 bg-border -z-0">
              <div
                className="h-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-300"
                style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between relative z-10">
              {steps.map((s) => {
                const Icon = s.icon;
                const isCompleted = step > s.num;
                const isCurrent = step === s.num;

                return (
                  <div key={s.num} className="flex flex-col items-center gap-1.5 group">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                        isCurrent
                          ? "bg-accent text-white ring-4 ring-accent/20 font-bold scale-105"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-surface-hover text-text-muted border border-border"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      ) : (
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                    <div className="text-center hidden sm:block">
                      <p
                        className={`text-[11px] font-bold tracking-tight transition-colors ${
                          isCurrent
                            ? "text-accent"
                            : isCompleted
                            ? "text-emerald-500"
                            : "text-text-muted"
                        }`}
                      >
                        {s.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Alert */}
          {error && (
            <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step Form Content */}
          <div className="min-h-[240px] flex flex-col justify-center">
            {/* STEP 1: ADMIN ACCOUNT */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-border/60 pb-2.5">
                  <h2 className="text-sm font-bold text-text flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" />
                    {t("step1_heading")}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("step1_description")}
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("fullName")}</label>
                    <Input
                      placeholder={t("fullNamePlaceholder")}
                      value={formData.adminName}
                      onChange={(e) => updateField("adminName", e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("email")}</label>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={formData.adminEmail}
                      onChange={(e) => updateField("adminEmail", e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      {t("password")} <span className="text-text-muted font-normal">{t("passwordMinHint")}</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={t("passwordPlaceholder")}
                        value={formData.adminPassword}
                        onChange={(e) => updateField("adminPassword", e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: BLOG SITE INFO */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-border/60 pb-2.5">
                  <h2 className="text-sm font-bold text-text flex items-center gap-2">
                    <Globe className="w-4 h-4 text-accent" />
                    {t("step2_heading")}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("step2_description")}
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("blogName")}</label>
                    <Input
                      placeholder={t("blogNamePlaceholder")}
                      value={formData.siteName}
                      onChange={(e) => updateField("siteName", e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("blogSubtitle")}</label>
                    <Input
                      placeholder={t("blogSubtitlePlaceholder")}
                      value={formData.siteSubtitle}
                      onChange={(e) => updateField("siteSubtitle", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("domain")}</label>
                    <Input
                      placeholder={t("domainPlaceholder")}
                      value={formData.domain}
                      onChange={(e) => updateField("domain", e.target.value)}
                    />
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                      <span>{t("canonicalUrl")}</span>
                      <span className="font-mono text-accent font-semibold px-1.5 py-0.5 bg-accent/10 rounded-sm border border-accent/20">
                        {cleanDomainPreview.includes("localhost") ? `http://${cleanDomainPreview}` : `https://${cleanDomainPreview}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: VISUAL BRANDING & THEME */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-border/60 pb-2.5">
                  <h2 className="text-sm font-bold text-text flex items-center gap-2">
                    <Palette className="w-4 h-4 text-accent" />
                    {t("step3_heading")}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("step3_description")}
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Color Preset Palette */}
                  <div>
                    <label className="block text-xs font-semibold text-text mb-2">{t("accentColor")}</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {colorPresets.map((preset) => {
                        const isSelected = formData.primaryColor === preset.hex;
                        return (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => updateField("primaryColor", preset.hex)}
                            className={`p-2 rounded-md border flex flex-col items-center gap-1 transition-all ${
                              isSelected
                                ? "border-accent bg-accent/10 font-bold"
                                : "border-border bg-surface-hover/30 hover:border-text-muted hover:bg-surface-hover"
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-sm flex items-center justify-center text-white"
                              style={{ backgroundColor: preset.hex }}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span className="text-[10px] text-text truncate">
                              {t(preset.nameKey)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Theme Mode Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-text mb-2">{t("defaultTheme")}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateField("theme", "dark")}
                        className={`p-3 rounded-md border flex items-center gap-3 transition-all text-left ${
                          formData.theme === "dark"
                            ? "border-accent bg-accent/10 text-accent font-bold"
                            : "border-border bg-surface-hover/30 text-text-muted hover:text-text hover:border-text-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-sm bg-slate-900 border border-slate-700 flex items-center justify-center text-accent shrink-0">
                          <Moon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text">{t("darkTheme")}</p>
                          <p className="text-[10px] text-text-muted">{t("darkThemeHint")}</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateField("theme", "light")}
                        className={`p-3 rounded-md border flex items-center gap-3 transition-all text-left ${
                          formData.theme === "light"
                            ? "border-accent bg-accent/10 text-accent font-bold"
                            : "border-border bg-surface-hover/30 text-text-muted hover:text-text hover:border-text-muted"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-sm bg-slate-100 border border-slate-300 flex items-center justify-center text-amber-500 shrink-0">
                          <Sun className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text">{t("lightTheme")}</p>
                          <p className="text-[10px] text-text-muted">{t("lightThemeHint")}</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: CATEGORIES & STARTER STRUCTURE */}
            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-border/60 pb-2.5">
                  <h2 className="text-sm font-bold text-text flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-accent" />
                    {t("step4_heading")}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("step4_description")}
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">{t("categoryName")}</label>
                    <Input
                      placeholder={t("categoryNamePlaceholder")}
                      value={formData.categoryName}
                      onChange={(e) => updateField("categoryName", e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Starter Content Preview Banner */}
                  <div className="p-3.5 rounded-md bg-surface-hover/40 border border-border text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-text">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>{t("starterSeedTitle")}</span>
                    </div>
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      {t("starterSeedDescription")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: SUCCESS / COMPLETED */}
            {step === 5 && (
              <div className="space-y-5 text-center py-3 animate-fade-in">
                <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 rounded-md flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>

                <div className="space-y-1 max-w-md mx-auto">
                  <h2 className="text-lg font-bold text-text tracking-tight">
                    {t("step5_heading")}
                  </h2>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {t("step5_description", { siteName: formData.siteName })}
                  </p>
                </div>

                {/* Summary Box */}
                <div className="p-3.5 rounded-md bg-surface-hover/30 border border-border text-xs text-left max-w-md mx-auto grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold block">{t("summaryAdmin")}</span>
                    <span className="font-medium text-text truncate block">{formData.adminEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold block">{t("summaryDomain")}</span>
                    <span className="font-mono text-accent font-semibold truncate block">{cleanDomainPreview}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold block">{t("summaryTheme")}</span>
                    <span className="font-medium text-text capitalize block">{formData.theme}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold block">{t("summaryCategory")}</span>
                    <span className="font-medium text-text block">{formData.categoryName}</span>
                  </div>
                </div>

                {/* CTA Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push("/admin")}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    {t("goToDashboard")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/")}
                    icon={<Laptop className="w-3.5 h-3.5" />}
                  >
                    {t("viewPublicBlog")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation Actions */}
          {step < 5 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              {step > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  icon={<ArrowLeft className="w-3.5 h-3.5" />}
                >
                  {t("previous")}
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  {t("continue")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleComplete}
                  loading={isPending}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  {t("initializeAndPublish")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
