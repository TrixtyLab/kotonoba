/**
 * Represents a single navigation link configured in the site navigation bar or footer.
 */
export interface SanitizedNavLinkItem {
  id: string;
  label: string;
  label_es?: string;
  label_en?: string;
  labels?: Record<string, string>;
  url: string;
  icon?: string;
  isFixed?: boolean;
  isSocial?: boolean;
  target?: "_blank" | "_self";
}

export interface SanitizeUrlOptions {
  /** Allow relative app paths beginning with `/` (but never `//` or `/\`). Defaults to `true`. */
  allowRelative?: boolean;
  /** Allow `mailto:` and `tel:` links. Defaults to `false`. */
  allowMailtoTel?: boolean;
}

const CONTROL_CHAR_REGEX = new RegExp("[\\x00-\\x1f\\x7f]");

function isUnsafeUrlPrefix(trimmed: string): boolean {
  return trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\");
}

function validateParsedProtocolUrl(trimmed: string, allowMailtoTel?: boolean): string | null {
  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (proto === "http:" || proto === "https:") return parsed.toString();
    if (allowMailtoTel && (proto === "mailto:" || proto === "tel:")) return trimmed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates and normalizes an untrusted URL for safe use in links, images, and forms.
 * Rejects `javascript:`, `vbscript:`, `data:`, `file:`, protocol-relative `//`, and
 * embedded control characters.
 *
 * @param rawUrl - Candidate URL or path string.
 * @param options - Options controlling relative paths and `mailto:`/`tel:` allowance.
 * @returns Sanitized trimmed URL string, or `null` when unsafe or empty.
 */
export function sanitizeUrl(
  rawUrl: string | null | undefined,
  options: SanitizeUrlOptions = {}
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || CONTROL_CHAR_REGEX.test(trimmed) || isUnsafeUrlPrefix(trimmed)) return null;

  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return options.allowRelative !== false ? trimmed : null;
  }

  return validateParsedProtocolUrl(trimmed, options.allowMailtoTel);
}

/**
 * Checks whether a sanitized URL points to an external `http:` or `https:` origin.
 *
 * @param url - Validated URL or path string.
 * @returns `true` for external HTTP/HTTPS links.
 */
export function isExternalHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function extractCleanNavLabels(rawLabels: unknown): Record<string, string> | undefined {
  if (!rawLabels || typeof rawLabels !== "object" || Array.isArray(rawLabels)) return undefined;
  const entries = Object.entries(rawLabels as Record<string, unknown>)
    .filter(([k, v]) => typeof k === "string" && typeof v === "string" && k.length <= 10 && v.trim().length > 0)
    .map(([k, v]) => [k, (v as string).trim().slice(0, 120)]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function copyOptionalNavMetadata(
  record: Record<string, unknown>,
  cleanItem: SanitizedNavLinkItem,
  cleanLabels?: Record<string, string>
): void {
  if (typeof record.label_es === "string" && record.label_es.trim()) cleanItem.label_es = record.label_es.trim().slice(0, 120);
  if (typeof record.label_en === "string" && record.label_en.trim()) cleanItem.label_en = record.label_en.trim().slice(0, 120);
  if (cleanLabels) cleanItem.labels = cleanLabels;
  if (typeof record.icon === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(record.icon.trim())) {
    cleanItem.icon = record.icon.trim();
  }
  if (record.isFixed === true) cleanItem.isFixed = true;
  if (record.isSocial === true) cleanItem.isSocial = true;
  if (record.target === "_blank" || record.target === "_self") cleanItem.target = record.target;
}

function sanitizeSingleNavLink(item: unknown, fallbackIndex: number): SanitizedNavLinkItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const safeUrl = sanitizeUrl(typeof record.url === "string" ? record.url : "", {
    allowRelative: true,
    allowMailtoTel: true,
  });
  if (!safeUrl) return null;

  const cleanLabels = extractCleanNavLabels(record.labels);
  const label = typeof record.label === "string" ? record.label.trim().slice(0, 120) : "";
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim().slice(0, 64) : `nav-${fallbackIndex}`;

  const cleanItem: SanitizedNavLinkItem = {
    id,
    label: label || cleanLabels?.en || cleanLabels?.es || "Link",
    url: safeUrl,
  };
  copyOptionalNavMetadata(record, cleanItem, cleanLabels);
  return cleanItem;
}

/**
 * Parses and sanitizes serialized site `navLinks` JSON, filtering out malformed items
 * and unsafe link destinations while preserving supported multi-locale labels.
 *
 * @param rawJson - Raw JSON string from site configuration or client payload.
 * @returns Normalized JSON array string containing only valid navigation link entries.
 */
export function sanitizeNavLinksJson(rawJson: string | null | undefined): string {
  if (!rawJson || !rawJson.trim()) return "[]";

  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return "[]";

    const cleanItems: SanitizedNavLinkItem[] = [];
    for (const item of parsed) {
      const clean = sanitizeSingleNavLink(item, cleanItems.length + 1);
      if (clean) cleanItems.push(clean);
    }
    return JSON.stringify(cleanItems);
  } catch {
    return "[]";
  }
}
