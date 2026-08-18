"use client";

import { useState, useTransition } from "react";
import { completeSetupWizard, type SetupWizardData } from "@/actions/setup";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ShieldCheck, Globe, Palette, FolderPlus, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles
} from "lucide-react";

/**
 * 5-Step initial setup wizard allowing the administrator to bootstrap the CMS,
 * create the master account, customize site theme, and publish the first article.
 */
export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SetupWizardData>({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    siteName: "My Tech Blog",
    siteSubtitle: "Insights on software architecture, design, and AI",
    domain: "localhost:3000",
    locale: "en",
    theme: "dark",
    primaryColor: "#6366f1",
    fontFamily: "Inter",
    categoryName: "Engineering",
  });

  function updateField<K extends keyof SetupWizardData>(field: K, val: SetupWizardData[K]) {
    setFormData((prev) => ({ ...prev, [field]: val }));
  }

  function validateStep(currentStep: number): boolean {
    setError(null);
    if (currentStep === 1) {
      if (!formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword.trim()) {
        setError("Please complete all administrator fields.");
        return false;
      }
      if (formData.adminPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.siteName.trim()) {
        setError("Please enter a blog name.");
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
    startTransition(async () => {
      const res = await completeSetupWizard(formData);
      if (res.success) {
        setStep(5);
      } else {
        setError(res.error || "Failed to initialize site.");
      }
    });
  }

  const steps = [
    { num: 1, label: "Admin", icon: ShieldCheck },
    { num: 2, label: "Site Info", icon: Globe },
    { num: 3, label: "Branding", icon: Palette },
    { num: 4, label: "Category", icon: FolderPlus },
    { num: 5, label: "Finish", icon: CheckCircle2 },
  ];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-bg via-surface/40 to-bg">
      <div className="w-full max-w-xl glass-strong rounded-2xl p-6 sm:p-8 shadow-2xl border border-border space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary text-white font-bold text-lg flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            K
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Setup Kotonoba</h1>
          <p className="text-xs text-text-muted">Configure your high-performance multi-tenant blog in minutes</p>
        </div>

        <div className="flex items-center justify-between relative px-2">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-0" />
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;

            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                    isCurrent
                      ? "bg-primary text-white ring-4 ring-primary/20 scale-110 shadow-md shadow-primary/30"
                      : isCompleted
                      ? "bg-success text-white"
                      : "bg-surface-hover text-text-muted border border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-text-muted hidden sm:block">{s.label}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3 bg-danger/15 text-danger border border-danger/30 rounded-md text-xs font-medium animate-slide-down">
            {error}
          </div>
        )}

        <div className="min-h-[220px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text">Step 1: Create Master Admin Account</h2>
                <p className="text-xs text-text-muted">This account will hold super-admin permissions.</p>
              </div>
              <Input
                label="Full Name"
                placeholder="Jane Doe"
                value={formData.adminName}
                onChange={(e) => updateField("adminName", e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="admin@example.com"
                value={formData.adminEmail}
                onChange={(e) => updateField("adminEmail", e.target.value)}
              />
              <Input
                label="Password (min 8 chars)"
                type="password"
                placeholder="••••••••••••"
                value={formData.adminPassword}
                onChange={(e) => updateField("adminPassword", e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text">Step 2: Blog Information</h2>
                <p className="text-xs text-text-muted">Title, tagline, and primary domain name.</p>
              </div>
              <Input
                label="Blog Title"
                placeholder="My Tech Blog"
                value={formData.siteName}
                onChange={(e) => updateField("siteName", e.target.value)}
              />
              <Input
                label="Subtitle / Tagline"
                placeholder="Thoughts on code, architecture, and technology"
                value={formData.siteSubtitle}
                onChange={(e) => updateField("siteSubtitle", e.target.value)}
              />
              <Input
                label="Domain / Subdomain"
                placeholder="blog.example.com or localhost:3000"
                value={formData.domain}
                onChange={(e) => updateField("domain", e.target.value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text">Step 3: Visual Theme & Branding</h2>
                <p className="text-xs text-text-muted">Choose your preferred default aesthetic.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Accent Color
                </label>
                <div className="flex gap-3">
                  {["#6366f1", "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateField("primaryColor", c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full transition-transform btn-press ${
                        formData.primaryColor === c ? "ring-4 ring-white/40 scale-110 shadow-lg" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  Default Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField("theme", "dark")}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                      formData.theme === "dark"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    🌙 Dark Mode (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("theme", "light")}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                      formData.theme === "light"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    ☀️ Light Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text">Step 4: Initial Category</h2>
                <p className="text-xs text-text-muted">Create your first category to organize articles.</p>
              </div>
              <Input
                label="Primary Category Name"
                placeholder="Engineering, Design, News…"
                value={formData.categoryName}
                onChange={(e) => updateField("categoryName", e.target.value)}
              />
              <div className="p-3 bg-surface/50 border border-border rounded-lg text-xs text-text-muted space-y-1">
                <p className="font-semibold text-text">✨ Automatic initialization:</p>
                <p>We will automatically publish a welcome article showcasing Mermaid diagrams and Markdown features.</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-center py-4 animate-fade-in">
              <div className="w-14 h-14 bg-success/15 border border-success/30 text-success rounded-full flex items-center justify-center mx-auto shadow-lg shadow-success/10">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-text">Your Blog is Ready!</h2>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Admin account, multi-tenant site, category, and initial post have been successfully created.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" onClick={() => router.push("/admin")}>
                  Enter Admin Dashboard
                </Button>
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Visit Public Blog
                </Button>
              </div>
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            ) : <div />}

            {step < 4 ? (
              <Button variant="primary" size="sm" onClick={handleNext}>
                Next Step
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleComplete} loading={isPending}>
                Complete Setup
                <CheckCircle2 className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
