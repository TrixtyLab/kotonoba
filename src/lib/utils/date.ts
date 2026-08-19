/**
 * Formats a Date object into a localized human-readable full date string.
 *
 * @param date - The JavaScript Date instance to format.
 * @param locale - BCP 47 language tag (e.g., 'en', 'es') for internationalization. Defaults to 'en'.
 * @returns Formatted date string (e.g., 'August 18, 2026' or '18 de agosto de 2026').
 */
export function formatDate(date: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Calculates and returns a relative time description comparing the target date to the current timestamp.
 *
 * @param date - The JavaScript Date instance to evaluate against the current time.
 * @returns A relative duration string (e.g., 'just now', '5m ago', '2h ago', '3d ago') or full date if older than 30 days.
 */
export function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/**
 * Extracts the ISO 8601 calendar date portion (YYYY-MM-DD) from a Date object.
 *
 * @param date - The JavaScript Date instance.
 * @returns A standard ISO date string in YYYY-MM-DD format.
 */
export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}
