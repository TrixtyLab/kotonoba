import { getPublicSite, getCanonicalBaseUrl, getRequestNormalizedHost, type Site } from "@/lib/tenant";
import { getCachedSiteSeoSettings } from "@/lib/queries/seo";
import { resolveCanonicalBodyText } from "@/lib/content/canonical";
import { getLocalizedText } from "@/lib/utils/localization";
import { normalizeLocale, type Locale } from "@/i18n/locales";

export interface LlmsSiteContext {
  allowed: true;
  site: Site;
  siteName: string;
  siteDesc: string;
  siteLocale: Locale;
  baseUrl: string;
  host: string;
  customInstructions: string;
}

export type LlmsContextResult = LlmsSiteContext | { allowed: false };

/**
 * Resolves the active public tenant and verifies via tenant-cached SEO settings that AI
 * crawler blocking is off and `llms_txt_enabled` is explicitly enabled before serving `/llms*.txt`.
 */
export async function resolveLlmsContext(reqHeaders: Headers): Promise<LlmsContextResult> {
  const site = await getPublicSite();
  if (!site) {
    return { allowed: false };
  }

  const host = await getRequestNormalizedHost();
  const seo = await getCachedSiteSeoSettings(site.id, host);
  if (seo.blockAiCrawlers || !seo.llmsTxtEnabled) {
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
    host,
    customInstructions: seo.llmsTxtCustom,
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
 * Normalizes canonical post content (`content` / `contentFormat` with legacy fallback)
 * into readable plain text for `/llms-full.txt` ingestion without leaking HTML tags or scripts.
 */
export function extractReadablePostText(post: {
  content?: string | null;
  contentMd?: string | null;
  contentHtml?: string | null;
  contentFormat?: string | null;
}): string {
  const body = resolveCanonicalBodyText(post).trim();
  if (!body) return "";

  if (post.contentFormat === "markdown" && !/^<[a-z!/]/i.test(body)) {
    return body;
  }

  const sourceHtml = body;
  let strippedHtml = sourceHtml;
  let previous: string;
  do {
    previous = strippedHtml;
    strippedHtml = strippedHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
  } while (strippedHtml !== previous);

  return strippedHtml
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
