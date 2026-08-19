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
 * Checks whether the Dub.co integration API key is configured in the environment.
 *
 * @returns True if DUB_API_KEY is present and non-empty, false otherwise.
 */
export function isDubConfigured(): boolean {
  const key = process.env.DUB_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Creates a shortened, campaign-tracked link using the Dub.co REST API.
 *
 * @param options - Parameters configuring the destination URL, UTM tags, and custom slug.
 * @returns A Promise resolving to the created DubLinkResult, or null if the integration is disabled or the API returns an error.
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
    tags: options.tags || ["blog-cms"],
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
