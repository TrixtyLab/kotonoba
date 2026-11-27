import { NextRequest, NextResponse } from "next/server";
import { formatPostUrlForLocale, resolveLlmsContext } from "@/lib/feeds/llms";
import { getCachedLlmsSummaryData } from "@/lib/queries/seo";

export const dynamic = "force-dynamic";

/**
 * Route handler generating standard `llms.txt` document for AI web crawlers and LLM search systems.
 *
 * @param req - The incoming NextRequest object.
 * @returns Plaintext llms.txt markdown response or 404 if disabled.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await resolveLlmsContext(req.headers);
  if (!ctx.allowed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { site, siteName, siteDesc, baseUrl, host, customInstructions } = ctx;
  const { topPosts, allCategories } = await getCachedLlmsSummaryData(site.id, host);

  let text = `# ${siteName}\n\n`;
  text += `> ${siteDesc}\n\n`;

  if (customInstructions) {
    text += `## System & AI Guidance\n\n${customInstructions}\n\n`;
  }

  text += `## Core Content & Articles\n\n`;
  for (const post of topPosts) {
    const postUrl = formatPostUrlForLocale(baseUrl, post.slug, post.locale);
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
