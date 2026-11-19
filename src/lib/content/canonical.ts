import { normalizeHtmlMediaUrls } from "@/lib/utils/media";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

/** Supported storage formats for post and custom page bodies. */
export type CanonicalContentFormat = "html" | "markdown";

/** Canonical sanitized body fields ready to persist into SQLite. */
export interface CanonicalContentFields {
  contentMd: string;
  contentHtml: string;
  contentFormat: CanonicalContentFormat;
}

/**
 * Normalizes media references, detects canonical content format (`"html"` vs `"markdown"`),
 * and sanitizes any HTML payloads before persistence in posts, pages, or backup imports.
 *
 * @param rawMd - Raw markdown or HTML string from editor/import.
 * @param rawHtml - Rendered or TipTap HTML string.
 * @param explicitFormat - Optional explicit format override.
 * @returns Sanitized canonical body tuple.
 */
export function resolveCanonicalContent(
  rawMd?: string | null,
  rawHtml?: string | null,
  explicitFormat?: CanonicalContentFormat
): CanonicalContentFields {
  const normalizedMd = normalizeHtmlMediaUrls(rawMd || "");
  const normalizedHtml = normalizeHtmlMediaUrls(rawHtml || "");
  const contentFormat: CanonicalContentFormat =
    explicitFormat ||
    (/^<[a-z!/]/i.test(normalizedMd.trim()) || normalizedHtml.trim().length > 0
      ? "html"
      : "markdown");

  const contentHtml = sanitizeRichHtml(
    normalizedHtml || (contentFormat === "html" ? normalizedMd : "")
  );
  const contentMd =
    contentFormat === "html" && /^<[a-z!/]/i.test(normalizedMd.trim())
      ? sanitizeRichHtml(normalizedMd)
      : normalizedMd;

  return {
    contentMd,
    contentHtml,
    contentFormat,
  };
}
