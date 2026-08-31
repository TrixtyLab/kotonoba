import { getDb } from "@/lib/db";
import { posts, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Configuration options for generating a tracked short URL via the Dub.co API.
 */
export interface DubCreateLinkOptions {
  /** The destination long URL to be shortened. */
  url: string;
  /** Optional custom slug identifier for the short link. */
  slug?: string;
  /** Custom branded domain registered in Dub.co (defaults to DUB_DOMAIN or 'dub.sh'). */
  domain?: string;
  /** UTM Source parameter value. */
  utmSource?: string;
  /** UTM Medium parameter value. */
  utmMedium?: string;
  /** UTM Campaign parameter value. */
  utmCampaign?: string;
  /** UTM Term keyword parameter value. */
  utmTerm?: string;
  /** UTM Content creative parameter value. */
  utmContent?: string;
  /** Array of tagging labels for Dub.co organization. */
  tags?: string[];
  /** Internal comment metadata describing the link origin. */
  comments?: string;
}

/**
 * Result payload containing the generated short URL, key, and QR code asset.
 */
export interface DubLinkResult {
  /** Dub.co link record identifier. */
  id: string;
  /** Short link key / slug. */
  key: string;
  /** Fully qualified short URL string. */
  shortUrl: string;
  /** Direct URL to the generated QR code image. */
  qrCodeUrl: string;
}

/**
 * Representation of a tracked link record retrieved from Dub.co.
 */
export interface DubLinkItem {
  /** Dub.co link record identifier. */
  id: string;
  /** Branded or default domain of the short link. */
  domain: string;
  /** Short link slug / key. */
  key: string;
  /** Target destination long URL. */
  url: string;
  /** Fully qualified short URL string. */
  shortLink: string;
  /** Total lifetime clicks recorded for this link. */
  clicks: number;
  /** Number of generated leads (if conversion tracking enabled). */
  leads: number;
  /** Number of completed sales (if revenue tracking enabled). */
  sales: number;
  /** URL to the generated dynamic QR code image. */
  qrCode?: string;
  /** ISO timestamp string representing link creation time. */
  createdAt: string;
  /** ISO timestamp string of the most recent click event, or null if unclicked. */
  lastClicked?: string | null;
}

/**
 * Query options for fetching and filtering Dub.co links.
 */
export interface GetDubLinksOptions {
  /** Optional custom domain filter. */
  customDomain?: string;
  /** Optional database site identifier to filter links specific to a site. */
  siteId?: string;
  /** Optional tag name filter. */
  tag?: string;
}

/**
 * Aggregated metrics summary of all active Dub.co shortlinks across the blog deployment.
 */
export interface DubAnalyticsSummary {
  /** Boolean flag indicating if DUB_API_KEY is configured in the environment. */
  isConfigured: boolean;
  /** Active custom or default Dub.co domain. */
  domain: string;
  /** Aggregated sum of clicks across all tracked links. */
  totalClicks: number;
  /** Total count of tracked short links. */
  totalLinks: number;
  /** Array of individual link records sorted by click count descending. */
  links: DubLinkItem[];
  /** The most clicked shortlink record, or null if no links exist. */
  topLink: DubLinkItem | null;
}

/**
 * Checks whether the Dub.co integration API key is configured in the environment.
 *
 * @returns {boolean} True if DUB_API_KEY is present and non-empty, false otherwise.
 */
export function isDubConfigured(): boolean {
  const key = process.env.DUB_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Creates a shortened, campaign-tracked link using the Dub.co REST API.
 *
 * @param {DubCreateLinkOptions} options - Parameters configuring the destination URL, UTM tags, and custom slug.
 * @returns {Promise<DubLinkResult | null>} A Promise resolving to the created DubLinkResult, or null if disabled/error.
 */
export async function createDubLink(options: DubCreateLinkOptions): Promise<DubLinkResult | null> {
  const apiKey = process.env.DUB_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const domain = options.domain || process.env.DUB_DOMAIN || "dub.sh";

  const payload: Record<string, unknown> = {
    url: options.url,
    domain,
    utm_source: options.utmSource || undefined,
    utm_medium: options.utmMedium || undefined,
    utm_campaign: options.utmCampaign || undefined,
    utm_term: options.utmTerm || undefined,
    utm_content: options.utmContent || undefined,
    tags: options.tags || ["blog", "blog-cms"],
    comments: options.comments || "Created via Kotonoba CMS",
  };

  if (options.slug && options.slug.trim().length > 0) {
    payload.key = options.slug.trim();
  }

  try {
    const res = await fetch("https://api.dub.co/links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn("Dub.co API returned error:", errData);
      return null;
    }

    const data = await res.json();
    const shortUrl = data.shortLink || `https://${data.domain}/${data.key}`;
    const qrCodeUrl = data.qrCode || `https://api.dub.co/qr?url=${encodeURIComponent(shortUrl)}`;

    return {
      id: data.id,
      key: data.key,
      shortUrl,
      qrCodeUrl,
    };
  } catch (error) {
    console.error("Error connecting to Dub.co API:", error);
    return null;
  }
}

/**
 * Fetches tracked links created for this blog and their click analytics from the Dub.co REST API.
 * Filters out links from other external applications or projects in the same Dub account.
 *
 * @param {string | GetDubLinksOptions} [options] - Custom domain string or GetDubLinksOptions object.
 * @returns {Promise<DubLinkItem[]>} A Promise resolving to an array of DubLinkItem records created in this blog.
 */
export async function getDubLinks(options?: string | GetDubLinksOptions): Promise<DubLinkItem[]> {
  const apiKey = process.env.DUB_API_KEY?.trim();
  if (!apiKey) return [];

  const opts: GetDubLinksOptions =
    typeof options === "string"
      ? options.includes("-") && options.length > 20
        ? { siteId: options }
        : { customDomain: options }
      : options || {};

  const domain = opts.customDomain || process.env.DUB_DOMAIN || "dub.sh";

  try {
    const url = new URL("https://api.dub.co/links");
    if (domain) {
      url.searchParams.set("domain", domain);
    }
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("sort", "clicks");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const knownLinkIds = new Set<string>();
    const knownShortUrls = new Set<string>();
    let siteDomain = "";

    try {
      const db = getDb();
      if (opts.siteId) {
        const siteRecord = db
          .select({ domain: sites.domain })
          .from(sites)
          .where(eq(sites.id, opts.siteId))
          .get();

        if (siteRecord?.domain) {
          siteDomain = siteRecord.domain
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
        }

        const sitePosts = db
          .select({
            dubLinkId: posts.dubLinkId,
            shortUrl: posts.shortUrl,
          })
          .from(posts)
          .where(eq(posts.siteId, opts.siteId))
          .all();

        for (const p of sitePosts) {
          if (p.dubLinkId) knownLinkIds.add(p.dubLinkId);
          if (p.shortUrl) knownShortUrls.add(p.shortUrl.toLowerCase());
        }
      } else {
        const allPosts = db
          .select({
            dubLinkId: posts.dubLinkId,
            shortUrl: posts.shortUrl,
          })
          .from(posts)
          .all();

        for (const p of allPosts) {
          if (p.dubLinkId) knownLinkIds.add(p.dubLinkId);
          if (p.shortUrl) knownShortUrls.add(p.shortUrl.toLowerCase());
        }
      }
    } catch {
      // Non-blocking DB fallback
    }

    const filtered = data.filter((item: any) => {
      const id = String(item.id || "");
      const shortUrl = (item.shortLink || `https://${item.domain}/${item.key}`).toLowerCase();
      const targetUrl = String(item.url || "").toLowerCase();
      const comments = typeof item.comments === "string" ? item.comments : "";

      const rawTags: string[] = Array.isArray(item.tags)
        ? item.tags
            .map((t: any) => (typeof t === "string" ? t : t?.name || t?.slug || ""))
            .filter(Boolean)
        : [];

      if (knownLinkIds.has(id)) return true;

      if (knownShortUrls.has(shortUrl)) return true;

      const hasBlogTag = rawTags.some((t) => {
        const lower = t.toLowerCase();
        return lower === "blog" || lower === "blog-cms" || lower.includes("kotonoba");
      });
      if (hasBlogTag) return true;

      if (
        comments.includes("Kotonoba") ||
        comments.includes("blog-cms") ||
        comments.startsWith("Article:")
      ) {
        return true;
      }

      if (siteDomain && targetUrl.includes(siteDomain)) {
        return true;
      }

      return false;
    });

    return filtered.map((item: any) => {
      const shortUrl = item.shortLink || `https://${item.domain}/${item.key}`;
      return {
        id: String(item.id || ""),
        domain: String(item.domain || domain),
        key: String(item.key || ""),
        url: String(item.url || ""),
        shortLink: shortUrl,
        clicks: typeof item.clicks === "number" ? item.clicks : 0,
        leads: typeof item.leads === "number" ? item.leads : 0,
        sales: typeof item.sales === "number" ? item.sales : 0,
        qrCode: item.qrCode || `https://api.dub.co/qr?url=${encodeURIComponent(shortUrl)}`,
        createdAt: item.createdAt || new Date().toISOString(),
        lastClicked: item.lastClicked || null,
      };
    });
  } catch (error) {
    console.warn("Failed to fetch links from Dub.co API:", error);
    return [];
  }
}

/**
 * Compiles a comprehensive analytics summary of active Dub.co shortlinks created for the blog.
 *
 * @param {string | GetDubLinksOptions} [options] - Optional site ID or GetDubLinksOptions.
 * @returns {Promise<DubAnalyticsSummary>} A Promise resolving to a DubAnalyticsSummary object.
 */
export async function getDubAnalyticsSummary(
  options?: string | GetDubLinksOptions
): Promise<DubAnalyticsSummary> {
  const isConfigured = isDubConfigured();
  const opts: GetDubLinksOptions =
    typeof options === "string"
      ? options.includes("-") && options.length > 20
        ? { siteId: options }
        : { customDomain: options }
      : options || {};

  const domain = opts.customDomain || process.env.DUB_DOMAIN || "dub.sh";

  if (!isConfigured) {
    return {
      isConfigured: false,
      domain,
      totalClicks: 0,
      totalLinks: 0,
      links: [],
      topLink: null,
    };
  }

  const links = await getDubLinks(opts);
  const totalClicks = links.reduce((acc, l) => acc + l.clicks, 0);
  const sortedLinks = [...links].sort((a, b) => b.clicks - a.clicks);
  const topLink = sortedLinks.length > 0 ? sortedLinks[0] : null;

  return {
    isConfigured: true,
    domain,
    totalClicks,
    totalLinks: links.length,
    links: sortedLinks,
    topLink,
  };
}

/**
 * Retrieves detailed link information, real-time clicks, and QR assets for a specific Dub link ID.
 *
 * @param {string} linkId - Unique Dub.co link identifier.
 * @returns {Promise<DubLinkItem | null>} A Promise resolving to a DubLinkItem or null.
 */
export async function getDubLinkInfo(linkId: string): Promise<DubLinkItem | null> {
  const apiKey = process.env.DUB_API_KEY?.trim();
  if (!apiKey || !linkId) return null;

  try {
    const res = await fetch(`https://api.dub.co/links/${encodeURIComponent(linkId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) return null;
    const item = await res.json();
    const shortUrl = item.shortLink || `https://${item.domain}/${item.key}`;
    return {
      id: String(item.id || ""),
      domain: String(item.domain || ""),
      key: String(item.key || ""),
      url: String(item.url || ""),
      shortLink: shortUrl,
      clicks: typeof item.clicks === "number" ? item.clicks : 0,
      leads: typeof item.leads === "number" ? item.leads : 0,
      sales: typeof item.sales === "number" ? item.sales : 0,
      qrCode: item.qrCode || `https://api.dub.co/qr?url=${encodeURIComponent(shortUrl)}`,
      createdAt: item.createdAt || new Date().toISOString(),
      lastClicked: item.lastClicked || null,
    };
  } catch (error) {
    console.warn("Failed to fetch link info from Dub.co:", error);
    return null;
  }
}
