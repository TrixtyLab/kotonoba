import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, settings } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { publishScheduledPosts, getPublicPostCondition } from "@/lib/db/scheduled";
import { getLocalizedText } from "@/lib/utils/localization";
import { getSiteForHost, getActiveSite, getCanonicalBaseUrl } from "@/lib/tenant";

/**
 * Route handler delivering complete full-text markdown corpus of published blog posts for RAG and deep LLM ingestion.
 *
 * @param req - The incoming NextRequest object.
 * @returns Plaintext complete article markdown response.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const db = getDb();
  const site = (await getSiteForHost()) || (await getActiveSite());

  if (!site) {
    return new NextResponse("Not Found", { status: 404 });
  }

  await publishScheduledPosts(site.id);

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

  const siteLocale = site.locale || "en";
  const siteName = getLocalizedText(site.name, siteLocale) || "Kotonoba";
  const baseUrl = await getCanonicalBaseUrl(site, req.headers);

  const topPosts = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
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
