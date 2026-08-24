import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSiteForHost, getActiveSite, getCanonicalBaseUrl } from "@/lib/tenant";

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
  const site = (await getSiteForHost()) || (await getActiveSite());
  const baseUrl = await getCanonicalBaseUrl(site);

  const db = getDb();
  const antiAiSetting = site
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, site.id), eq(settings.key, "block_ai_crawlers")))
        .get()
    : null;

  const isAiBlocked = antiAiSetting?.value === "true";

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
