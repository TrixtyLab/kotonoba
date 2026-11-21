"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

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
        <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-text">{t("adminTitle")}</h1>
        <p className="text-xs text-text-muted leading-relaxed">{t("adminDescription")}</p>
        {digest && (
          <p className="text-[11px] font-mono text-text-muted">
            {t("digestLabel")}: {digest}
          </p>
        )}
        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("retry")}</span>
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface-hover/50 text-text text-xs font-semibold hover:bg-surface-hover transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>{t("backAdmin")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
