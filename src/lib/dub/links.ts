import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { getDubEnvConfig } from "@/lib/config/env";
import { isDubFeatureEnabled } from "@/lib/config/features";
import { eq } from "drizzle-orm";
import type { DubApiLinkItem, DubCreateLinkOptions, DubLinkItem, DubLinkResult } from "./types";

/** Checks whether the Dub.co integration API key is configured in the environment. */
export function isDubConfigured(): boolean {
  return isDubFeatureEnabled();
}

/** Normalizes a raw Dub.co REST API link object into a typed {@link DubLinkItem}. */
export function mapDubApiLinkItem(item: DubApiLinkItem, fallbackDomain = ""): DubLinkItem {
  const shortUrl = item.shortLink || `https://${item.domain}/${item.key}`;
  return {
    id: String(item.id || ""),
    domain: String(item.domain || fallbackDomain),
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
}

function buildDubCreatePayload(
  options: DubCreateLinkOptions,
  defaultDomain?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    url: options.url,
    domain: options.domain || defaultDomain,
    utm_source: options.utmSource || undefined,
    utm_medium: options.utmMedium || undefined,
    utm_campaign: options.utmCampaign || undefined,
    utm_term: options.utmTerm || undefined,
    utm_content: options.utmContent || undefined,
    tags: options.tags || ["blog", "blog-cms"],
    comments: options.comments || "Created via Kotonoba CMS",
  };
  const trimmedSlug = options.slug?.trim();
  if (trimmedSlug) payload.key = trimmedSlug;
  return payload;
}

/** Creates a shortened, campaign-tracked link using the Dub.co REST API. */
export async function createDubLink(options: DubCreateLinkOptions): Promise<DubLinkResult | null> {
  const { apiKey, domain: defaultDomain } = getDubEnvConfig();
  if (!apiKey) return null;

  const payload = buildDubCreatePayload(options, defaultDomain);

  try {
    const res = await fetch("https://api.dub.co/links", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    return { id: data.id, key: data.key, shortUrl, qrCodeUrl };
  } catch (error) {
    console.error("Error connecting to Dub.co API:", error);
    return null;
  }
}

/** Retrieves detailed link information and click telemetry for a specific Dub link ID. */
export async function getDubLinkInfo(linkId: string): Promise<DubLinkItem | null> {
  const { apiKey } = getDubEnvConfig();
  if (!apiKey || !linkId) return null;

  try {
    const res = await fetch(`https://api.dub.co/links/${encodeURIComponent(linkId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const item = (await res.json()) as DubApiLinkItem;
    return mapDubApiLinkItem(item);
  } catch (error) {
    console.warn("Failed to fetch link info from Dub.co:", error);
    return null;
  }
}

/** Permanently deletes a tracked short link from the Dub.co API. */
export async function deleteDubLink(linkId: string): Promise<boolean> {
  const { apiKey } = getDubEnvConfig();
  if (!apiKey || !linkId) return false;

  try {
    const res = await fetch(`https://api.dub.co/links/${encodeURIComponent(linkId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      if (res.status === 404) return true;
      const errorData = await res.json().catch(() => ({}));
      console.warn("Dub.co API delete error:", errorData);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error deleting Dub.co link:", error);
    return false;
  }
}

/** Saves the generated Dub.co short URL and link ID onto a persisted post record. */
export function bindPostDubShortLink(postId: string, shortUrl: string, dubLinkId: string): void {
  getDb().update(posts).set({ shortUrl, dubLinkId }).where(eq(posts.id, postId)).run();
}
