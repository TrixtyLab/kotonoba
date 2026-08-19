import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { sites, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
export default function robots(): MetadataRoute.Robots {
  const db = getDb();
  const primarySite = db.select().from(sites).limit(1).get();
  const baseUrl = primarySite ? `https://${primarySite.domain}` : (process.env.SITE_URL || "http://localhost:3000");

  const antiAiSetting = primarySite
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, primarySite.id), eq(settings.key, "block_ai_crawlers")))
        .get()
    : null;

  const isAiBlocked = antiAiSetting?.value === "true";

  const standardRule = {
    userAgent: "*",
    allow: ["/", "/entry/*", "/category/*", "/tag/*", "/archive"],
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
