/**
 * Formats a Date object into a localized human-readable full date string.
 *
 * @param {Date} date - The JavaScript Date instance to format.
 * @param {string} [locale='en'] - BCP 47 language tag (e.g., 'en', 'es') for internationalization.
 * @returns {string} Formatted date string (e.g., 'August 18, 2026' or '18 de agosto de 2026').
 */
export function formatDate(date: Date, locale = "en"): string {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  try {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", opts).format(date);
  }
}
