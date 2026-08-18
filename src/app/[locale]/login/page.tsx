"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/actions/auth";
import { useRouter, Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Shield, Lock, Mail, ArrowRight } from "lucide-react";

/**
 * Admin authentication page handling sign in and redirecting to the setup wizard if no administrators exist.
 */
export default function LoginPage() {
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
        const errorMsg = res.error || (res.errors ? Object.values(res.errors).flat().join(", ") : "Invalid email or password");
        setError(errorMsg);
      }
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-bg via-surface/40 to-bg relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md glass-strong rounded-2xl p-6 sm:p-8 shadow-2xl border border-border space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary text-white font-bold text-lg flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Kotonoba Admin</h1>
          <p className="text-xs text-text-muted">Sign in to manage your multi-tenant blogs and articles</p>
        </div>

        {error && (
          <div className="p-3 bg-danger/15 text-danger border border-danger/30 rounded-md text-xs font-medium animate-slide-down">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
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
            Sign In to Dashboard
          </Button>
        </form>

        <div className="pt-4 border-t border-border/50 text-center">
          <Link
            href="/setup"
            className="text-xs text-primary hover:text-primary-hover font-semibold transition-colors inline-flex items-center gap-1"
          >
            First time? Run Setup Wizard →
          </Link>
        </div>
      </div>
    </main>
  );
}
