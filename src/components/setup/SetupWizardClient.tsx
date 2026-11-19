"use client";

import React, { useState, useTransition } from "react";
import type { SetupWizardData } from "@/lib/services/setup";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SetupStepPanels } from "@/components/setup/SetupStepPanels";
import { useTranslations, useLocale } from "next-intl";
import {
  ShieldCheck,
  Globe,
  Palette,
  FolderPlus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";

/**
 * Guided multi-step onboarding wizard for bootstrapping the administrator account, initial blog site, and initial taxonomy structure.
 * Clean, flat, modern architecture with zero rounded bubble containers or heavy shadows.
 *
 * @returns React JSX setup wizard interface.
 */
export function SetupWizardClient() {
  const t = useTranslations("setup");
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
      if (
        formData.adminPassword.length < 10 ||
        !/[A-Z]/.test(formData.adminPassword) ||
        !/[a-z]/.test(formData.adminPassword) ||
        !/[0-9]/.test(formData.adminPassword)
      ) {
        setError(`${t("errorPasswordLength")} (10+ chars, uppercase, lowercase, number)`);
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
      try {
        const response = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            locale: locale || formData.locale || "es",
          }),
        });
        const res = (await response.json()) as {
          success?: boolean;
          error?: string;
        };
        if (response.ok && res.success) {
          setStep(5);
        } else {
          setError(res.error || t("errorGeneric"));
        }
      } catch {
        setError(t("errorGeneric"));
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
            <SetupStepPanels
              step={step}
              formData={formData}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword((prev) => !prev)}
              cleanDomainPreview={cleanDomainPreview}
              onUpdateField={updateField}
              onGoToDashboard={() => router.push("/admin")}
              onViewPublicBlog={() => router.push("/")}
            />
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
