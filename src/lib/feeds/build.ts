import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, pages, categories, tags, settings } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getPublicPostCondition, getPublicPageCondition } from "@/lib/db/scheduled";
import { LOCALES, normalizeLocale, type Locale } from "@/i18n/locales";
import { getPublicSite, getCanonicalBaseUrl, getRequestNormalizedHost } from "@/lib/tenant";
import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { formatPostUrlForLocale } from "@/lib/feeds/llms";
import { resolveCanonicalBodyText } from "@/lib/content/canonical";
import { renderPostContent } from "@/lib/utils/markdown";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";

function safeCdata(value: string): string {
  return value.replace(/]]>/g, "]]]]><![CDATA[>");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveSiteEnabledLocales(
  rawSupported?: string | null,
  fallbackLocale?: string | null
): Locale[] {
  const defaultLoc = normalizeLocale(fallbackLocale);
  if (rawSupported) {
    try {
      const parsed = JSON.parse(rawSupported);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((loc): loc is Locale =>
          (LOCALES as readonly string[]).includes(loc)
        );
        if (clean.length > 0) return Array.from(new Set(clean));
      }
    } catch {
      // Ignore malformed supportedLocales JSON
    }
  }
  return [defaultLoc];
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Result returned by {@link buildSiteRssFeedXml}. */
export type RssBuildResult =
  | { ok: true; xml: string }
  | { ok: false; status: 404; message: string };

/**
 * Generates an RSS 2.0 XML document for the active blog tenant using canonical
 * locale-aware URLs (`en` without `/en` prefix) matching sitemap and LLMs outputs.
 */
export async function buildSiteRssFeedXml(reqHeaders?: Headers | null): Promise<RssBuildResult> {
  const site = await getPublicSite();
  if (!site) {
    return { ok: false, status: 404, message: "Blog site not found" };
  }

  const host = await getRequestNormalizedHost();
  const baseUrl = await getCanonicalBaseUrl(site, reqHeaders);
  const siteLocale = normalizeLocale(site.locale);

  const feedData = await runWithTenantCache(
    async () => {
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
        return { enabled: false as const, posts: [], includeFullContent: true };
      }

      const itemsLimit = Math.min(Math.max(parseInt(configMap.rss_items_count || "20", 10), 1), 100);
      const includeFullContent = configMap.rss_full_content !== "false";

      const publishedPosts = db
        .select()
        .from(posts)
        .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
        .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
        .limit(itemsLimit)
        .all();

      return { enabled: true as const, posts: publishedPosts, includeFullContent };
    },
    ["rss-feed-data", site.id, host, siteLocale],
    { tags: [sitePostsCacheTag(site.id)], revalidate: 60 }
  );

  if (!feedData.enabled) {
    return { ok: false, status: 404, message: "RSS Feed is disabled for this blog." };
  }

  const lastBuildDate = feedData.posts[0]?.publishedAt
    ? toDate(feedData.posts[0].publishedAt).toUTCString()
    : new Date().toUTCString();

  const itemsXml = feedData.posts
    .map((post) => {
      const postLocale = normalizeLocale(post.locale || siteLocale);
      const postUrl = formatPostUrlForLocale(baseUrl, post.slug, postLocale);
      const pubDate = post.publishedAt
        ? toDate(post.publishedAt).toUTCString()
        : toDate(post.createdAt).toUTCString();
      const coverUrl = resolveAbsoluteUrl(post.coverImage, baseUrl);
      const rawBody = resolveCanonicalBodyText(post);
      const content = feedData.includeFullContent
        ? post.contentFormat === "markdown"
          ? renderPostContent(rawBody, { format: "markdown" })
          : sanitizeRichHtml(rawBody || post.excerpt || "")
        : post.excerpt || "";

      return `    <item>
      <title><![CDATA[${safeCdata(post.title)}]]></title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${safeCdata(post.excerpt || "")}]]></description>
      <content:encoded><![CDATA[${safeCdata(content)}]]></content:encoded>
      ${coverUrl ? `<enclosure url="${escapeXml(coverUrl)}" type="image/jpeg" length="0"/>` : ""}
    </item>`;
    })
    .join("\n");

  const channelTitle = getLocalizedText(site.name, siteLocale);
  const channelDesc = getLocalizedText(site.subtitle || site.description || site.name, siteLocale);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:dc="http://purl.org/dc/elements/1.1/" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/" 
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${safeCdata(channelTitle)}]]></title>
    <link>${escapeXml(baseUrl)}</link>
    <description><![CDATA[${safeCdata(channelDesc)}]]></description>
    <language>${escapeXml(siteLocale)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(`${baseUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return { ok: true, xml };
}

function buildLocalizedAlternates(
  siteLocales: Locale[],
  baseUrl: string,
  suffix: string
): { alternates: { languages: Record<string, string> } } | Record<string, never> {
  if (siteLocales.length <= 1) return {};
  return {
    alternates: {
      languages: Object.fromEntries(
        siteLocales.map((l) => [l, l === "en" ? `${baseUrl}${suffix}` : `${baseUrl}/${l}${suffix}`])
      ),
    },
  };
}

/**
 * Generates cached, tenant-scoped XML sitemap entries covering home, archive,
 * categories, tags, custom pages, and published articles.
 */
export async function buildSiteSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const site = await getPublicSite();
  const baseUrl = await getCanonicalBaseUrl(site);
  const host = await getRequestNormalizedHost();
  const siteLocale = normalizeLocale(site?.locale);
  const siteLocales = resolveSiteEnabledLocales(site?.supportedLocales, site?.locale);

  const cachedData = site
    ? await runWithTenantCache(
        async () => {
          const db = getDb();
          const publishedPosts = db
            .select({ slug: posts.slug, locale: posts.locale, updatedAt: posts.updatedAt })
            .from(posts)
            .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
            .orderBy(desc(posts.publishedAt))
            .limit(5000)
            .all();

          const publishedPages = db
            .select({ slug: pages.slug, locale: pages.locale, updatedAt: pages.updatedAt })
            .from(pages)
            .where(and(eq(pages.siteId, site.id), getPublicPageCondition()))
            .orderBy(desc(pages.publishedAt))
            .limit(1000)
            .all();

          const allCategories = db
            .select({ slug: categories.slug })
            .from(categories)
            .where(eq(categories.siteId, site.id))
            .all();

          const allTags = db
            .select({ slug: tags.slug })
            .from(tags)
            .where(eq(tags.siteId, site.id))
            .all();

          return { publishedPosts, publishedPages, allCategories, allTags };
        },
        ["public-sitemap", site.id, host, siteLocale],
        { tags: [sitePostsCacheTag(site.id)], revalidate: 60 }
      )
    : { publishedPosts: [], publishedPages: [], allCategories: [], allTags: [] };

  const now = new Date();
  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
      ...buildLocalizedAlternates(siteLocales, baseUrl, ""),
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      ...buildLocalizedAlternates(siteLocales, baseUrl, "/archive"),
    },
    ...cachedData.allCategories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      ...buildLocalizedAlternates(siteLocales, baseUrl, `/category/${c.slug}`),
    })),
    ...cachedData.allTags.map((t) => ({
      url: `${baseUrl}/tag/${t.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...buildLocalizedAlternates(siteLocales, baseUrl, `/tag/${t.slug}`),
    })),
    ...cachedData.publishedPages.map((p) => {
      const pageLocale = normalizeLocale(p.locale);
      const pageUrl = pageLocale === "en" ? `${baseUrl}/p/${p.slug}` : `${baseUrl}/${pageLocale}/p/${p.slug}`;
      return {
        url: pageUrl,
        lastModified: toDate(p.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.8,
        alternates: { languages: { [pageLocale]: pageUrl } },
      };
    }),
    ...cachedData.publishedPosts.map((p) => {
      const postLocale = normalizeLocale(p.locale);
      const postUrl = formatPostUrlForLocale(baseUrl, p.slug, postLocale);
      return {
        url: postUrl,
        lastModified: toDate(p.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.9,
        alternates: { languages: { [postLocale]: postUrl } },
      };
    }),
  ];
}
