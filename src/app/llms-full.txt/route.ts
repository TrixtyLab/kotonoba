import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getPublicPostCondition } from "@/lib/db/scheduled";
import {
  extractReadablePostText,
  formatPostUrlForLocale,
  resolveLlmsContext,
} from "@/lib/feeds/llms";

export const dynamic = "force-dynamic";

/**
 * Route handler delivering complete full-text markdown corpus of published blog posts for RAG and deep LLM ingestion.
 *
 * @param req - The incoming NextRequest object.
 * @returns Plaintext complete article markdown response.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await resolveLlmsContext(req.headers);
  if (!ctx.allowed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const db = getDb();
  const { site, siteName, baseUrl } = ctx;

  const topPosts = db
    .select({
      title: posts.title,
      slug: posts.slug,
      locale: posts.locale,
      publishedAt: posts.publishedAt,
      excerpt: posts.excerpt,
      contentMd: posts.contentMd,
      contentHtml: posts.contentHtml,
      contentFormat: posts.contentFormat,
    })
    .from(posts)
    .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
    .orderBy(desc(posts.publishedAt))
    .limit(20)
    .all();

  let text = `# ${siteName} — Full Content Index\n\n`;

  for (const post of topPosts) {
    text += `---\n\n`;
    text += `## ${post.title}\n\n`;
    text += `- **URL**: ${formatPostUrlForLocale(baseUrl, post.slug, post.locale)}\n`;
    if (post.publishedAt) {
      text += `- **Published**: ${post.publishedAt.toISOString()}\n`;
    }
    if (post.excerpt) {
      text += `- **Summary**: ${post.excerpt}\n`;
    }
    const readableBody = extractReadablePostText(post);
    text += `\n${readableBody}\n\n`;
  }

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
