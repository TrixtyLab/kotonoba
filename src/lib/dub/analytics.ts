import { getDb } from "@/lib/db";
import { posts, sites } from "@/lib/db/schema";
import { getDubEnvConfig } from "@/lib/config/env";
import { eq } from "drizzle-orm";
import { isDubConfigured, mapDubApiLinkItem } from "./links";
import type { DubAnalyticsSummary, DubApiLinkItem, DubLinkItem, GetDubLinksOptions } from "./types";

function parseDubLinksOptions(options?: string | GetDubLinksOptions): GetDubLinksOptions {
  if (typeof options !== "string") return options || {};
  return options.includes("-") && options.length > 20
    ? { siteId: options }
    : { customDomain: options };
}

function loadKnownSiteLinks(siteId?: string): {
  knownLinkIds: Set<string>;
  knownShortUrls: Set<string>;
  siteDomain: string;
} {
  const knownLinkIds = new Set<string>();
  const knownShortUrls = new Set<string>();
  let siteDomain = "";

  try {
    const db = getDb();
    if (siteId) {
      const siteRecord = db.select({ domain: sites.domain }).from(sites).where(eq(sites.id, siteId)).get();
      if (siteRecord?.domain) {
        siteDomain = siteRecord.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      }
    }

    const postLinks = siteId
      ? db.select({ dubLinkId: posts.dubLinkId, shortUrl: posts.shortUrl }).from(posts).where(eq(posts.siteId, siteId)).all()
      : db.select({ dubLinkId: posts.dubLinkId, shortUrl: posts.shortUrl }).from(posts).all();

    for (const p of postLinks) {
      if (p.dubLinkId) knownLinkIds.add(p.dubLinkId);
      if (p.shortUrl) knownShortUrls.add(p.shortUrl.toLowerCase());
    }
  } catch {
    // Non-blocking DB fallback
  }

  return { knownLinkIds, knownShortUrls, siteDomain };
}

function isMatchingBlogLink(
  item: DubApiLinkItem,
  context: { knownLinkIds: Set<string>; knownShortUrls: Set<string>; siteDomain: string }
): boolean {
  const id = String(item.id || "");
  const shortUrl = (item.shortLink || `https://${item.domain}/${item.key}`).toLowerCase();
  if (context.knownLinkIds.has(id) || context.knownShortUrls.has(shortUrl)) return true;

  const rawTags = Array.isArray(item.tags)
    ? item.tags.map((t) => (typeof t === "string" ? t : t?.name || t?.slug || "")).filter(Boolean)
    : [];
  if (rawTags.some((t) => ["blog", "blog-cms"].includes(t.toLowerCase()) || t.toLowerCase().includes("kotonoba"))) {
    return true;
  }

  const comments = typeof item.comments === "string" ? item.comments : "";
  if (comments.includes("Kotonoba") || comments.includes("blog-cms") || comments.startsWith("Article:")) {
    return true;
  }

  const targetUrl = String(item.url || "").toLowerCase();
  return Boolean(context.siteDomain && targetUrl.includes(context.siteDomain));
}

/** Fetches tracked links created for this blog and their click analytics from Dub.co. */
export async function getDubLinks(options?: string | GetDubLinksOptions): Promise<DubLinkItem[]> {
  const { apiKey, domain: defaultDomain } = getDubEnvConfig();
  if (!apiKey) return [];

  const opts = parseDubLinksOptions(options);
  const domain = opts.customDomain || defaultDomain;

  try {
    const url = new URL("https://api.dub.co/links");
    if (domain) url.searchParams.set("domain", domain);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("sort", "clicks");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const siteContext = loadKnownSiteLinks(opts.siteId);
    return (data as DubApiLinkItem[])
      .filter((item) => isMatchingBlogLink(item, siteContext))
      .map((item) => mapDubApiLinkItem(item, domain));
  } catch (error) {
    console.warn("Failed to fetch links from Dub.co API:", error);
    return [];
  }
}

/** Compiles an aggregated analytics summary of active Dub.co shortlinks created for the blog. */
export async function getDubAnalyticsSummary(
  options?: string | GetDubLinksOptions
): Promise<DubAnalyticsSummary> {
  const opts = parseDubLinksOptions(options);
  const domain = opts.customDomain || getDubEnvConfig().domain;

  if (!isDubConfigured()) {
    return { isConfigured: false, domain, totalClicks: 0, totalLinks: 0, links: [], topLink: null };
  }

  const links = await getDubLinks(opts);
  const totalClicks = links.reduce((acc, l) => acc + l.clicks, 0);
  const sortedLinks = [...links].sort((a, b) => b.clicks - a.clicks);

  return {
    isConfigured: true,
    domain,
    totalClicks,
    totalLinks: links.length,
    links: sortedLinks,
    topLink: sortedLinks[0] || null,
  };
}
