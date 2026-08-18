import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, sites, categories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Generates standard llms.txt file for AI search engines (Perplexity, ChatGPT, Claude, Gemini).
 */
export async function GET(req: NextRequest) {
  const db = getDb();
  const host = req.headers.get("host")?.split(":")[0] || "localhost";
  const site = db.select().from(sites).where(eq(sites.domain, host)).get() || db.select().from(sites).limit(1).get();

  const siteName = site?.name || "Kotonoba";
  const siteDesc = site?.description || "High-performance multi-tenant blog CMS";
  const baseUrl = `https://${site?.domain || host}`;

  const topPosts = db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.views), desc(posts.publishedAt))
    .limit(30)
    .all();

  const allCategories = db.select().from(categories).all();

  let text = `# ${siteName}\n\n`;
  text += `> ${siteDesc}\n\n`;

  text += `## Core Content & High-Signal Articles\n\n`;
  for (const post of topPosts) {
    const url = `${baseUrl}/entry/${post.slug}`;
    const descText = post.excerpt ? `: ${post.excerpt}` : "";
    text += `- [${post.title}](${url})${descText}\n`;
  }

  if (allCategories.length > 0) {
    text += `\n## Categories\n\n`;
    for (const cat of allCategories) {
      text += `- [${cat.name}](${baseUrl}/category/${cat.slug})\n`;
    }
  }

  text += `\n## Machine-Readable Full Markdown\n\n`;
  text += `- [Full Article Index](${baseUrl}/llms-full.txt): Complete markdown text of published entries for direct model context.\n`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
