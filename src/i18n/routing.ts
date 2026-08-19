import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/** List of supported BCP 47 locale codes across the application. */
export const LOCALES = ["en", "es"] as const;

/** Type union of supported language codes. */
export type Locale = (typeof LOCALES)[number];

/** Human-readable language display names mapped by locale code. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

/**
 * Global Next-Intl routing configuration defining default locale and prefix behaviors.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
