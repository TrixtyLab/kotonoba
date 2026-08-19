import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, sites, categories, settings } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Route handler generating standard `llms.txt` document for AI web crawlers and LLM search systems.
 *
 * @param req - The incoming NextRequest object.
 * @returns Plaintext llms.txt markdown response or 404 if disabled.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const db = getDb();
  const host = req.headers.get("host")?.split(":")[0] || "localhost";
  const site = db.select().from(sites).where(eq(sites.domain, host)).get() || db.select().from(sites).limit(1).get();

  if (!site) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const antiAiSetting = db
    .select()
    .from(settings)
    .where(and(eq(settings.siteId, site.id), eq(settings.key, "block_ai_crawlers")))
    .get();

  if (antiAiSetting?.value === "true") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const llmsSetting = db
    .select()
    .from(settings)
    .where(and(eq(settings.siteId, site.id), eq(settings.key, "llms_txt_enabled")))
    .get();

  if (!llmsSetting || llmsSetting.value !== "true") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const customInstructions = db
    .select()
    .from(settings)
    .where(and(eq(settings.siteId, site.id), eq(settings.key, "llms_txt_custom")))
    .get()?.value;

  const siteName = site.name || "Kotonoba";
  const siteDesc = site.description || "High-performance multi-tenant blog CMS";
  const baseUrl = `https://${site.domain || host}`;

  const topPosts = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.views), desc(posts.publishedAt))
    .limit(30)
    .all();

  const allCategories = db
    .select()
    .from(categories)
    .where(eq(categories.siteId, site.id))
    .all();

  let text = `# ${siteName}\n\n`;
  text += `> ${siteDesc}\n\n`;

  if (customInstructions && customInstructions.trim()) {
    text += `## System & AI Guidance\n\n${customInstructions.trim()}\n\n`;
  }

  text += `## Core Content & Articles\n\n`;
  for (const post of topPosts) {
    const postUrl = `${baseUrl}/entry/${post.slug}`;
    text += `- [${post.title}](${postUrl})`;
    if (post.excerpt) {
      text += `: ${post.excerpt.replace(/\n+/g, " ").trim()}`;
    }
    text += `\n`;
  }

  if (allCategories.length > 0) {
    text += `\n## Categories\n\n`;
    for (const cat of allCategories) {
      text += `- [${cat.name}](${baseUrl}/category/${cat.slug})\n`;
    }
  }

  text += `\n## Links\n\n`;
  text += `- [Full Corpus Index](${baseUrl}/llms-full.txt): Complete unformatted article text index for RAG ingestion\n`;
  text += `- [XML Sitemap](${baseUrl}/sitemap.xml)\n`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
