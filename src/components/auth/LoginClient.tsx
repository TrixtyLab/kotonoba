"use client";

import React, { useState, useTransition } from "react";
import { loginAction } from "@/actions/auth";
import { useRouter, Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Shield, ArrowRight } from "lucide-react";

/**
 * Configuration properties for the LoginClient component.
 */
export interface LoginClientProps {
  /** Controls visibility of the initial setup wizard link when no admin exists. */
  showSetupLink: boolean;
}

/**
 * Authentication login interface enabling administrators to authenticate with credentials and access the dashboard.
 *
 * @param props - LoginClientProps configuring setup wizard link display.
 * @returns React JSX login page element.
 */
export function LoginClient({ showSetupLink }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (res.success) {
        router.push("/admin");
      } else {
        const errorMsg =
          res.error ||
          (res.errors ? Object.values(res.errors).flat().join(", ") : "Credenciales inválidas");
        setError(errorMsg);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-bg relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-surface rounded-2xl p-6 sm:p-8 shadow-xl border border-border space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-text text-bg font-bold text-base flex items-center justify-center mx-auto shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-text tracking-tight">Kotonoba Admin</h1>
          <p className="text-xs text-text-muted">Inicia sesión para gestionar tus blogs y artículos</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-xs font-medium animate-slide-down">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="admin@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isPending}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Iniciar Sesión
          </Button>
        </form>

        {showSetupLink && (
          <div className="pt-4 border-t border-border text-center">
            <Link
              href="/setup"
              className="text-xs text-accent hover:underline font-semibold transition-colors inline-flex items-center gap-1"
            >
              ¿Primera vez? Asistente de Configuración →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
