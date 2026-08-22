"use client";

import React, { useState, useTransition } from "react";
import { loginAction } from "@/actions/auth";
import { useRouter, Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "next-intl";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

/**
 * Configuration properties for the LoginClient component.
 */
export interface LoginClientProps {
  /** Controls visibility of the initial setup wizard link when no admin exists. */
  showSetupLink: boolean;
}

/**
 * Authentication login interface enabling administrators to authenticate with credentials and access the dashboard.
 * Clean, flat, modern aesthetic without bloated bubbles or heavy shadows.
 *
 * @param props - LoginClientProps configuring setup wizard link display.
 * @returns React JSX login page element.
 */
export function LoginClient({ showSetupLink }: LoginClientProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          (res.errors ? Object.values(res.errors).flat().join(", ") : t("invalidCredentials"));
        setError(errorMsg);
      }
    });
  }

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-bg relative select-none">
      {/* Top Floating Controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-surface rounded-lg p-6 sm:p-8 border border-border space-y-6">
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

        {error && (
          <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">{t("email")}</label>
            <Input
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">{t("password")}</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full font-bold mt-2"
            loading={isPending}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            {t("signIn")}
          </Button>
        </form>

        {showSetupLink && (
          <div className="pt-4 border-t border-border text-center">
            <Link
              href="/setup"
              className="text-xs text-accent hover:text-accent/80 font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <span>{t("setupPrompt")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
