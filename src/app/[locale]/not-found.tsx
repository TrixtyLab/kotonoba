import React from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

/**
 * Localized 404 fallback page rendered within `[locale]` segments on missing entities or routes.
 */
export default async function LocaleNotFoundPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("errors");

  return (
    <main className="min-h-[65vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-6 text-center space-y-4 shadow-xs">
        <p className="text-xs font-mono uppercase tracking-widest text-accent">404</p>
        <h1 className="text-xl font-bold text-text">{t("notFoundTitle")}</h1>
        <p className="text-xs text-text-muted leading-relaxed">{t("notFoundDescription")}</p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
