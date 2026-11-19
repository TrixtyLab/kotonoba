/** List of supported BCP 47 locale codes across the application. */
export const LOCALES = ["en", "es"] as const;

/** Type union of supported language codes. */
export type Locale = (typeof LOCALES)[number];

/**
 * Coerces an arbitrary locale string into a supported {@link Locale} (`"en"` or `"es"`).
 *
 * @param raw - Candidate locale string.
 * @returns Validated locale code, defaulting to `"en"`.
 */
export function normalizeLocale(raw?: string | null): Locale {
  return raw && (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : "en";
}

/** Human-readable language display names mapped by locale code. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};
