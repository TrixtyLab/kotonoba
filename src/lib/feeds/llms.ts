import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getPublicSite, getCanonicalBaseUrl, type Site } from "@/lib/tenant";
import { getLocalizedText } from "@/lib/utils/localization";
import { normalizeLocale, type Locale } from "@/i18n/locales";

export interface LlmsSiteContext {
  allowed: true;
  site: Site;
  siteName: string;
  siteDesc: string;
  siteLocale: Locale;
  baseUrl: string;
  customInstructions: string;
}

export type LlmsContextResult = LlmsSiteContext | { allowed: false };

/**
 * Resolves the active public tenant and verifies that AI crawler blocking is off
 * and `llms_txt_enabled` is explicitly enabled before serving `/llms*.txt`.
 */
export async function resolveLlmsContext(reqHeaders: Headers): Promise<LlmsContextResult> {
  const site = await getPublicSite();
  if (!site) {
    return { allowed: false };
  }

  const db = getDb();
  const rows = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.siteId, site.id),
        inArray(settings.key, ["block_ai_crawlers", "llms_txt_enabled", "llms_txt_custom"])
      )
    )
    .all();

  const map = new Map(rows.map((r) => [r.key, r.value]));
  if (map.get("block_ai_crawlers") === "true" || map.get("llms_txt_enabled") !== "true") {
    return { allowed: false };
  }

  const siteLocale = normalizeLocale(site.locale);
  const baseUrl = await getCanonicalBaseUrl(site, reqHeaders);

  return {
    allowed: true,
    site,
    siteName: getLocalizedText(site.name, siteLocale) || "Kotonoba",
    siteDesc:
      getLocalizedText(site.description, siteLocale) ||
      "High-performance multi-tenant blog CMS",
    siteLocale,
    baseUrl,
    customInstructions: (map.get("llms_txt_custom") || "").trim(),
  };
}

/**
 * Builds the canonical locale-aware URL for an article (`en` at root, `es` prefixed).
 */
export function formatPostUrlForLocale(
  baseUrl: string,
  slug: string,
  postLocale?: string | null
): string {
  const loc = normalizeLocale(postLocale);
  return loc === "en" ? `${baseUrl}/entry/${slug}` : `${baseUrl}/${loc}/entry/${slug}`;
}

/**
 * Normalizes canonical post content (`contentFormat === "markdown"` or sanitized HTML)
 * into readable plain text for `/llms-full.txt` ingestion without leaking HTML tags or scripts.
 */
export function extractReadablePostText(post: {
  contentMd?: string | null;
  contentHtml?: string | null;
  contentFormat?: string | null;
}): string {
  const md = (post.contentMd || "").trim();
  const html = (post.contentHtml || "").trim();

  if (post.contentFormat === "markdown" && md && !/^<[a-z!/]/i.test(md)) {
    return md;
  }

  const sourceHtml = html || md;
  if (!sourceHtml) return "";

  return sourceHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
