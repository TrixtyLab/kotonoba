import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { posts, sites, settings } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { publishScheduledPosts, getPublicPostCondition } from "@/lib/db/scheduled";
import { getSiteForHost, getActiveSite, getCanonicalBaseUrl } from "@/lib/tenant";
import { getLocalizedText } from "@/lib/utils/localization";
import { normalizeMediaUrl, resolveAbsoluteUrl } from "@/lib/storage";

/**
 * Escapes XML special characters within string literals.
 *
 * @param str - Raw string to sanitize.
 * @returns Escaped XML string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an RSS 2.0 XML document containing recent published articles for the active blog tenant.
 *
 * @returns {Promise<NextResponse>} Promise resolving to an XML formatted NextResponse stream.
 */
export async function GET(): Promise<NextResponse> {
  const site = (await getSiteForHost()) || (await getActiveSite());

  if (!site) {
    return new NextResponse("Blog site not found", { status: 404 });
  }

  const db = getDb();
  const siteSettings = db
    .select()
    .from(settings)
    .where(eq(settings.siteId, site.id))
    .all();

  const configMap: Record<string, string> = {};
  for (const s of siteSettings) {
    configMap[s.key] = s.value;
  }

  if (configMap.rss_enabled === "false") {
    return new NextResponse("RSS Feed is disabled for this blog.", { status: 404 });
  }

  const itemsLimit = Math.min(Math.max(parseInt(configMap.rss_items_count || "20", 10), 1), 100);
  const includeFullContent = configMap.rss_full_content !== "false";

  const baseUrl = await getCanonicalBaseUrl(site);
  await publishScheduledPosts(site.id);

  const publishedPosts = db
    .select()
    .from(posts)
    .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    .limit(itemsLimit)
    .all();

  const siteLocale = site.locale || "en";
  const lastBuildDate = publishedPosts[0]?.publishedAt
    ? new Date(publishedPosts[0].publishedAt).toUTCString()
    : new Date().toUTCString();

  const itemsXml = publishedPosts
    .map((post) => {
      const postLocale = post.locale || siteLocale;
      const postUrl = `${baseUrl}/${postLocale}/entry/${post.slug}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date(post.createdAt).toUTCString();
      const coverUrl = resolveAbsoluteUrl(post.coverImage, baseUrl);
      const content = includeFullContent
        ? post.contentHtml || post.contentMd || post.excerpt || ""
        : post.excerpt || "";

      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt || ""}]]></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      ${coverUrl ? `<enclosure url="${escapeXml(coverUrl)}" type="image/jpeg" length="0"/>` : ""}
    </item>`;
    })
    .join("\n");

  const channelTitle = getLocalizedText(site.name, siteLocale);
  const channelDesc = getLocalizedText(site.subtitle || site.description || site.name, siteLocale);

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:dc="http://purl.org/dc/elements/1.1/" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/" 
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${channelTitle}]]></title>
    <link>${escapeXml(baseUrl)}</link>
    <description><![CDATA[${channelDesc}]]></description>
    <language>${escapeXml(siteLocale)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(`${baseUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
