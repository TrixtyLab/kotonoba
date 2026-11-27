"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AdminErrorProps {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}

/**
 * Isolated error boundary for `/[locale]/admin` pages so workspace errors recover within the shell.
 */
export default function AdminErrorPage({
  error,
  retry,
  reset,
}: AdminErrorProps): React.JSX.Element {
  const t = useTranslations("errors");
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  const handleRetry = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
  };

  return (
    <div className="min-h-[55vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-6 text-center space-y-4 shadow-xs">
        <div className="w-10 h-10 rounded-lg bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-text">{t("adminTitle")}</h1>
        <p className="text-sm text-text-muted leading-relaxed">{t("adminDescription")}</p>
        {digest && (
          <p className="text-xs font-mono text-text-muted">
            {t("digestLabel")}: {digest}
          </p>
        )}
        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          <Button type="button" variant="accent" size="sm" onClick={handleRetry} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            {t("retry")}
          </Button>
          <Link href="/admin">
            <Button type="button" variant="outline" size="sm" icon={<LayoutDashboard className="w-3.5 h-3.5" />}>
              {t("backAdmin")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
