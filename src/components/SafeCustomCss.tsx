import { sanitizeCss } from "@/lib/security/sanitize";

/**
 * Renders tenant CSS after {@link sanitizeCss} removes tags, imports, and url().
 *
 * @param props - Raw custom CSS from the site row.
 * @returns A style element, or null when the sanitized CSS is empty.
 */
export function SafeCustomCss({ css }: { css: string | null | undefined }) {
  const clean = sanitizeCss(css);
  if (!clean) return null;
  return <style dangerouslySetInnerHTML={{ __html: clean }} />;
}
