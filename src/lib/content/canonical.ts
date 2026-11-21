import { normalizeHtmlMediaUrls } from "@/lib/utils/media";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

/** Supported storage formats for post and custom page bodies. */
export type CanonicalContentFormat = "html" | "markdown";

/** Canonical sanitized body fields ready to persist into SQLite. */
export interface CanonicalContentFields {
  content: string;
  contentMd: string;
  contentHtml: string;
  contentFormat: CanonicalContentFormat;
}

/**
 * Resolves the canonical body string from an existing post/page record, preferring
 * `content` while transparently falling back to legacy `contentHtml` / `contentMd`.
 */
export function resolveCanonicalBodyText(record: {
  content?: string | null;
  contentMd?: string | null;
  contentHtml?: string | null;
  contentFormat?: string | null;
}): string {
  const primary = (record.content || "").trim();
  if (primary) return record.content || "";
  if (record.contentFormat === "markdown") {
    return record.contentMd || record.contentHtml || "";
  }
  return record.contentHtml || record.contentMd || "";
}

function looksLikeHtmlMarkup(value: string): boolean {
  return /^<[a-z!/]/i.test(value.trim());
}

function resolveCanonicalInputs(rawMd?: string | null, rawHtml?: string | null, rawContent?: string | null) {
  const normalizedCanonical = normalizeHtmlMediaUrls(rawContent || "");
  const normalizedMd = normalizeHtmlMediaUrls(rawMd || "");
  const normalizedHtml = normalizeHtmlMediaUrls(rawHtml || "");
  const canonicalIsHtml = looksLikeHtmlMarkup(normalizedCanonical);
  return {
    normalizedCanonical,
    effectiveMd: normalizedMd || (!canonicalIsHtml ? normalizedCanonical : ""),
    effectiveHtml: normalizedHtml || (canonicalIsHtml ? normalizedCanonical : ""),
  };
}

/**
 * Normalizes media references, detects canonical content format (`"html"` vs `"markdown"`),
 * populates unified `content` + `contentFormat`, and clears HTML from `contentMd`.
 */
export function resolveCanonicalContent(
  rawMd?: string | null,
  rawHtml?: string | null,
  explicitFormat?: CanonicalContentFormat,
  rawContent?: string | null
): CanonicalContentFields {
  const { normalizedCanonical, effectiveMd, effectiveHtml } = resolveCanonicalInputs(
    rawMd,
    rawHtml,
    rawContent
  );

  const detectedFormat: CanonicalContentFormat =
    looksLikeHtmlMarkup(effectiveMd) || effectiveHtml.trim().length > 0 ? "html" : "markdown";
  const contentFormat = explicitFormat || detectedFormat;

  if (contentFormat === "html") {
    const cleanHtml = sanitizeRichHtml(effectiveHtml || effectiveMd || normalizedCanonical);
    return { content: cleanHtml, contentMd: "", contentHtml: cleanHtml, contentFormat };
  }

  const cleanMd = looksLikeHtmlMarkup(effectiveMd) ? "" : effectiveMd;
  const cleanHtml = effectiveHtml ? sanitizeRichHtml(effectiveHtml) : "";
  return { content: cleanMd, contentMd: cleanMd, contentHtml: cleanHtml, contentFormat };
}
