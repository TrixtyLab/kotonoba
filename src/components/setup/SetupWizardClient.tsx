"use client";

import React, { useState, useTransition } from "react";
import { completeSetupWizard, type SetupWizardData } from "@/actions/setup";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ShieldCheck, Globe, Palette, FolderPlus, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles
} from "lucide-react";

/**
 * Guided multi-step onboarding wizard for bootstrapping the administrator account, initial blog site, and initial taxonomy structure.
 *
 * @returns React JSX setup wizard interface.
 */
export function SetupWizardClient() {
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
    locale: "es",
    theme: "dark",
    primaryColor: "#3b82f6",
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
        setError("Por favor completa todos los campos del administrador.");
        return false;
      }
      if (formData.adminPassword.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.siteName.trim()) {
        setError("Ingresa el nombre del blog.");
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
        setError(res.error || "Error al inicializar el sitio.");
      }
    });
  }

  const steps = [
    { num: 1, label: "Admin", icon: ShieldCheck },
    { num: 2, label: "Blog", icon: Globe },
    { num: 3, label: "Marca", icon: Palette },
    { num: 4, label: "Categoría", icon: FolderPlus },
    { num: 5, label: "Listo", icon: CheckCircle2 },
  ];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-bg">
      <div className="w-full max-w-xl bg-surface rounded-2xl p-6 sm:p-8 shadow-xl border border-border space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-text text-bg font-bold text-base flex items-center justify-center mx-auto shadow-xs">
            K
          </div>
          <h1 className="text-xl font-bold text-text tracking-tight">Configuración Inicial de Kotonoba</h1>
          <p className="text-xs text-text-muted">Configura tu blog en solo unos minutos</p>
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
                      ? "bg-accent text-white ring-4 ring-accent/20 scale-110 shadow-xs"
                      : isCompleted
                      ? "bg-emerald-500 text-white"
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
          <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-xs font-medium animate-slide-down">
            {error}
          </div>
        )}

        <div className="min-h-[220px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-text">Paso 1: Cuenta Administrador Principal</h2>
                <p className="text-xs text-text-muted">Esta cuenta tendrá permisos de super_admin.</p>
              </div>
              <Input
                label="Nombre Completo"
                placeholder="Tu Nombre"
                value={formData.adminName}
                onChange={(e) => updateField("adminName", e.target.value)}
              />
              <Input
                label="Correo Electrónico"
                type="email"
                placeholder="admin@ejemplo.com"
                value={formData.adminEmail}
                onChange={(e) => updateField("adminEmail", e.target.value)}
              />
              <Input
                label="Contraseña (mínimo 8 caracteres)"
                type="password"
                placeholder="••••••••••••"
                value={formData.adminPassword}
                onChange={(e) => updateField("adminPassword", e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-text">Paso 2: Información del Blog</h2>
                <p className="text-xs text-text-muted">Título, lema y dominio principal.</p>
              </div>
              <Input
                label="Nombre del Blog"
                placeholder="Mi Blog de Tecnología"
                value={formData.siteName}
                onChange={(e) => updateField("siteName", e.target.value)}
              />
              <Input
                label="Lema / Subtítulo"
                placeholder="Reflexiones sobre ingeniería de software y diseño"
                value={formData.siteSubtitle}
                onChange={(e) => updateField("siteSubtitle", e.target.value)}
              />
              <Input
                label="Dominio / Host HTTP"
                placeholder="blog.midominio.com o localhost:3000"
                value={formData.domain}
                onChange={(e) => updateField("domain", e.target.value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-text">Paso 3: Identidad Visual</h2>
                <p className="text-xs text-text-muted">Elige el color de acento y tema predeterminado.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-2">
                  Color de Acento
                </label>
                <div className="flex gap-2.5">
                  {["#3b82f6", "#10b981", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateField("primaryColor", c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-lg transition-transform ${
                        formData.primaryColor === c ? "ring-2 ring-accent ring-offset-2 ring-offset-surface scale-110 shadow-xs" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">
                  Tema Predeterminado
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField("theme", "dark")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                      formData.theme === "dark"
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    Tema Oscuro
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("theme", "light")}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                      formData.theme === "light"
                        ? "border-accent bg-accent/10 text-accent font-bold"
                        : "border-border text-text-muted hover:text-text"
                    }`}
                  >
                    Tema Claro
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-text">Paso 4: Categoría Inicial</h2>
                <p className="text-xs text-text-muted">Crea tu primera categoría para organizar artículos.</p>
              </div>
              <Input
                label="Nombre de la Categoría"
                placeholder="Desarrollo, Diseño, Noticias…"
                value={formData.categoryName}
                onChange={(e) => updateField("categoryName", e.target.value)}
              />
              <div className="p-3 bg-surface-hover/30 border border-border rounded-lg text-xs text-text-muted space-y-1">
                <p className="font-semibold text-text">✨ Publicación de bienvenida:</p>
                <p>Publicaremos un artículo de bienvenida inicial para comprobar el funcionamiento del blog.</p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-center py-4 animate-fade-in">
              <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-text">¡Tu Blog está Listo!</h2>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                La cuenta de administrador y la configuración inicial se han creado exitosamente.
              </p>
              <div className="pt-3 flex flex-col sm:flex-row gap-2.5 justify-center">
                <Button variant="primary" size="sm" onClick={() => router.push("/admin")}>
                  Ir al Panel de Administración
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                  Ver Blog Público
                </Button>
              </div>
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {step > 1 ? (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
            ) : <div />}

            {step < 4 ? (
              <Button variant="primary" size="sm" onClick={handleNext}>
                Siguiente
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleComplete} loading={isPending}>
                Completar Configuración
                <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
