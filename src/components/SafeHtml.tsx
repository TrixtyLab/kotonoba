import { sanitizeRichHtml } from "@/lib/security/sanitize";

/**
 * Props for {@link SafeHtml}.
 */
export interface SafeHtmlProps {
  /** Raw or pre-rendered HTML markup; always re-sanitized via `sanitizeRichHtml` on render. */
  html: string;
  /** Optional CSS class names applied to the wrapper container. */
  className?: string;
}

/**
 * Single audited server component boundary permitted to pass rich HTML to React's
 * `dangerouslySetInnerHTML`, guaranteeing defense-in-depth sanitization before SSR output.
 *
 * @param props - HTML markup and optional CSS class.
 * @returns Sanitized HTML container `div`.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const cleanHtml = sanitizeRichHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}
