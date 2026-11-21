import { NextRequest, NextResponse } from "next/server";
import {
  extractReadablePostText,
  formatPostUrlForLocale,
  resolveLlmsContext,
} from "@/lib/feeds/llms";
import { getCachedLlmsFullPosts } from "@/lib/queries/seo";

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

  const { site, siteName, baseUrl, host } = ctx;
  const topPosts = await getCachedLlmsFullPosts(site.id, host);

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
