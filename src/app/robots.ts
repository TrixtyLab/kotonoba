import { MetadataRoute } from "next";
import { getPublicSite, getCanonicalBaseUrl, getRequestNormalizedHost } from "@/lib/tenant";
import { getCachedSiteSeoSettings } from "@/lib/queries/seo";

export const dynamic = "force-dynamic";

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Diffbot",
  "FacebookBot",
  "cohere-ai",
  "Omgilibot",
  "ImagesiftBot",
];

/**
 * Generates dynamic robots.txt crawlers configuration adhering to crawl budget guidelines, sitemap discovery, and optional Anti-AI crawler blocking policies.
 *
 * @returns MetadataRoute Robots definition object.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  const baseUrl = await getCanonicalBaseUrl(site);

  const seo = site ? await getCachedSiteSeoSettings(site.id, host) : null;
  const isAiBlocked = Boolean(seo?.blockAiCrawlers);

  const standardRule = {
    userAgent: "*",
    allow: ["/", "/entry/*", "/category/*", "/tag/*", "/archive", "/p/*"],
    disallow: ["/admin/", "/api/", "/setup/", "/login"],
  };

  const aiRules = isAiBlocked
    ? AI_BOTS.map((bot) => ({
        userAgent: bot,
        disallow: ["/"],
      }))
    : [];

  return {
    rules: [standardRule, ...aiRules],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
