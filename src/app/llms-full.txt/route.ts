import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, sites, settings } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Route handler delivering complete full-text markdown corpus of published blog posts for RAG and deep LLM ingestion.
 *
 * @param req - The incoming NextRequest object.
 * @returns Plaintext complete article markdown response.
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
    return new NextResponse("Not Found (AI Crawling Blocked)", { status: 404 });
  }

  const llmsSetting = db
    .select()
    .from(settings)
    .where(and(eq(settings.siteId, site.id), eq(settings.key, "llms_txt_enabled")))
    .get();

  if (!llmsSetting || llmsSetting.value !== "true") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const siteName = site.name || "Kotonoba";
  const baseUrl = `https://${site.domain || host}`;

  const topPosts = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt))
    .limit(20)
    .all();

  let text = `# ${siteName} — Full Content Index\n\n`;

  for (const post of topPosts) {
    text += `---\n\n`;
    text += `## ${post.title}\n\n`;
    text += `- **URL**: ${baseUrl}/entry/${post.slug}\n`;
    if (post.publishedAt) {
      text += `- **Published**: ${post.publishedAt.toISOString()}\n`;
    }
    if (post.excerpt) {
      text += `- **Summary**: ${post.excerpt}\n`;
    }
    text += `\n${post.contentMd || ""}\n\n`;
  }

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
