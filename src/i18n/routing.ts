import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from "./locales";

export { LOCALES, LOCALE_NAMES, normalizeLocale, type Locale };

/**
 * Global Next-Intl routing configuration defining default locale and prefix behaviors.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
