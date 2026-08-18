import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Returns full concatenated markdown of published articles for deep LLM consumption.
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
