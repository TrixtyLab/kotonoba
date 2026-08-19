import { getDb } from "@/lib/db";
import { sites, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Payload structure for a Discord webhook message containing rich embeds.
 */
export interface DiscordWebhookPayload {
  /** Display name override for the webhook sender. */
  username?: string;
  /** Image URL override for the webhook avatar icon. */
  avatar_url?: string;
  /** Array of rich embed objects. */
  embeds?: DiscordEmbed[];
}

/**
 * Rich embed specification following the Discord Webhook API standard.
 */
export interface DiscordEmbed {
  /** Embed author metadata. */
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  /** Embed headline title. */
  title: string;
  /** Hyperlink destination URL for the title. */
  url?: string;
  /** Main body description text. */
  description?: string;
  /** Decimal integer representation of the sidebar border color. */
  color?: number;
  /** Embed large hero image metadata. */
  image?: {
    url: string;
  };
  /** Small thumbnail image metadata. */
  thumbnail?: {
    url: string;
  };
  /** Footer label and icon metadata. */
  footer?: {
    text: string;
    icon_url?: string;
  };
  /** ISO 8601 timestamp string for message timing. */
  timestamp?: string;
}

/**
 * Converts a hexadecimal color string into a decimal integer accepted by Discord Webhooks.
 *
 * @param hex - Hexadecimal color code (e.g. '#3b82f6' or 'ff4081').
 * @returns Integer decimal color value.
 */
export function hexToDecimalColor(hex?: string): number {
  if (!hex) return 3900150;
  const clean = hex.replace("#", "").trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 3900150 : parsed;
}

/**
 * Resolves an absolute HTTP URL from a potentially relative asset path.
 *
 * @param urlOrPath - Relative asset path or full URL.
 * @param baseUrl - Canonical site base URL.
 * @returns Absolute HTTP(S) URL.
 */
function resolveAbsoluteUrl(urlOrPath: string | null | undefined, baseUrl: string): string | undefined {
  if (!urlOrPath) return undefined;
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return urlOrPath;
  }
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Dispatches an automated rich embed notification to Discord when an article is published.
 * Executes safely in a non-blocking background context.
 *
 * @param siteId - Unique database identifier of the blog site.
 * @param post - Published post data including title, slug, excerpt, and cover image.
 * @returns Promise resolving to true if sent successfully, false otherwise.
 */
export async function sendDiscordPostNotification(
  siteId: string,
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt?: Date | null;
    locale?: string;
    shortUrl?: string | null;
  }
): Promise<boolean> {
  try {
    const db = getDb();
    const siteSettings = db
      .select()
      .from(settings)
      .where(eq(settings.siteId, siteId))
      .all();

    const configMap: Record<string, string> = {};
    for (const s of siteSettings) {
      configMap[s.key] = s.value;
    }

    const enabled = configMap.discord_notifications_enabled === "true";
    const webhookUrl = configMap.discord_webhook_url;

    if (!enabled || !webhookUrl) {
      return false;
    }

    const site = db.select().from(sites).where(eq(sites.id, siteId)).get();
    const postLocale = post.locale || site?.locale || "en";
    const siteName = getLocalizedText(site?.name, postLocale) || "Kotonoba Blog";
    const siteDomain = site?.domain || "localhost:3000";
    const baseUrl = siteDomain.includes("localhost")
      ? `http://${siteDomain}`
      : `https://${siteDomain}`;

    const canonicalPostUrl = `${baseUrl}/${postLocale}/entry/${post.slug}`;
    const postUrl = post.shortUrl || canonicalPostUrl;
    const logoUrl = resolveAbsoluteUrl(site?.logoUrl || site?.faviconUrl, baseUrl);
    const coverImageUrl = resolveAbsoluteUrl(post.coverImage, baseUrl);
    const colorInt = hexToDecimalColor(site?.primaryColor || "#3b82f6");

    const description = post.excerpt?.trim() || "";

    const payload: DiscordWebhookPayload = {
      username: configMap.discord_bot_username || siteName,
      avatar_url: resolveAbsoluteUrl(configMap.discord_bot_avatar, baseUrl) || logoUrl,
      embeds: [
        {
          author: {
            name: siteName,
            url: baseUrl,
            icon_url: logoUrl,
          },
          title: post.title,
          url: postUrl,
          description: description ? description : undefined,
          color: colorInt,
          image: coverImageUrl ? { url: coverImageUrl } : undefined,
          footer: {
            text: siteName,
            icon_url: logoUrl,
          },
          timestamp: (post.publishedAt || new Date()).toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a test notification to a Discord webhook URL to verify channel connectivity.
 *
 * @param webhookUrl - Target Discord Webhook URL.
 * @param siteData - Optional site branding parameters.
 * @returns Promise resolving to an object with success boolean and error message.
 */
export async function sendDiscordTestNotification(
  webhookUrl: string,
  siteData?: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      return { success: false, error: "Invalid Discord Webhook URL format." };
    }

    const siteName = siteData?.name || "Kotonoba Blog";
    const colorInt = hexToDecimalColor(siteData?.primaryColor || "#3b82f6");

    const payload: DiscordWebhookPayload = {
      username: siteName,
      avatar_url: siteData?.logoUrl,
      embeds: [
        {
          author: {
            name: siteName,
            icon_url: siteData?.logoUrl,
          },
          title: "🎉 Discord Webhook Configured Successfully!",
          description: "New articles published on your Kotonoba blog will now be automatically shared to this channel.",
          color: colorInt,
          footer: {
            text: "Kotonoba CMS • Webhook Test",
            icon_url: siteData?.logoUrl,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return { success: true };
    }

    const errorText = await res.text();
    return { success: false, error: `Discord rejected webhook: ${res.status} ${errorText}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error contacting Discord";
    return { success: false, error: msg };
  }
}
