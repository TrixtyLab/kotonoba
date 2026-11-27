import { getDb } from "@/lib/db";
import { sites, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { decryptSecretOrLegacyPlaintext } from "@/lib/security/crypto";
import { safeOutboundFetchValidated, validateOutboundUrl } from "@/lib/security/ssrf";
import { buildSiteBaseUrl } from "@/lib/utils/site-url";

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
function hexToDecimalColor(hex?: string): number {
  if (!hex) return 3900150;
  const clean = hex.replace("#", "").trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 3900150 : parsed;
}

/**
 * Dispatches an automated rich embed notification to Discord when an article is published.
 * Executes safely in a non-blocking background context.
 *
 * @param {string} siteId - Unique database identifier of the blog site.
 * @param {Object} post - Published post data including title, slug, excerpt, and cover image.
 * @param {string} post.id - Unique database identifier of the post.
 * @param {string} post.title - Post headline.
 * @param {string} post.slug - URL slug for public routing.
 * @param {string | null} [post.excerpt] - Short summary excerpt.
 * @param {string | null} [post.coverImage] - Cover image asset path.
 * @param {Date | null} [post.publishedAt] - Publication timestamp.
 * @param {string} [post.locale] - Language locale identifier.
 * @param {string | null} [post.shortUrl] - Optional shortened redirect link.
 * @returns {Promise<boolean>} Promise resolving to true if sent successfully, false otherwise.
 */
function loadDiscordSiteConfig(siteId: string) {
  const db = getDb();
  const rows = db.select().from(settings).where(eq(settings.siteId, siteId)).all();
  const configMap: Record<string, string> = {};
  for (const s of rows) configMap[s.key] = s.value;

  const enabled = configMap.discord_notifications_enabled === "true";
  const webhookUrl = decryptSecretOrLegacyPlaintext(configMap.discord_webhook_url).trim();
  if (!enabled || !webhookUrl) return null;

  return {
    webhookUrl,
    botUsername: configMap.discord_bot_username,
    botAvatar: configMap.discord_bot_avatar,
  };
}

function resolveDiscordSiteBranding(siteId: string, requestedLocale?: string) {
  const site = getDb().select().from(sites).where(eq(sites.id, siteId)).get();
  const postLocale = requestedLocale || site?.locale || "en";
  const siteName = getLocalizedText(site?.name, postLocale) || "Kotonoba Blog";
  const baseUrl = buildSiteBaseUrl(site?.domain || "localhost:3000");
  const logoUrl = resolveAbsoluteUrl(site?.logoUrl || site?.faviconUrl, baseUrl);
  return {
    postLocale,
    siteName,
    baseUrl,
    logoUrl,
    colorInt: hexToDecimalColor(site?.primaryColor || "#3b82f6"),
  };
}

function buildDiscordPostPayload(
  siteId: string,
  config: { botUsername?: string; botAvatar?: string },
  post: {
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt?: Date | null;
    locale?: string;
    shortUrl?: string | null;
  }
): DiscordWebhookPayload {
  const branding = resolveDiscordSiteBranding(siteId, post.locale);
  const postUrl = post.shortUrl || `${branding.baseUrl}/${branding.postLocale}/entry/${post.slug}`;
  const coverImageUrl = resolveAbsoluteUrl(post.coverImage, branding.baseUrl);
  const description = post.excerpt?.trim() || "";

  return {
    username: config.botUsername || branding.siteName,
    avatar_url: resolveAbsoluteUrl(config.botAvatar, branding.baseUrl) || branding.logoUrl,
    embeds: [
      {
        author: { name: branding.siteName, url: branding.baseUrl, icon_url: branding.logoUrl },
        title: post.title,
        url: postUrl,
        description: description || undefined,
        color: branding.colorInt,
        image: coverImageUrl ? { url: coverImageUrl } : undefined,
        footer: { text: branding.siteName, icon_url: branding.logoUrl },
        timestamp: (post.publishedAt || new Date()).toISOString(),
      },
    ],
  };
}

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
    const config = loadDiscordSiteConfig(siteId);
    if (!config) return false;

    const webhookCheck = await validateOutboundUrl(config.webhookUrl, {
      allowedDomains: ["discord.com", "discordapp.com"],
    });
    if (!webhookCheck.valid || !webhookCheck.url.pathname.startsWith("/api/webhooks/")) {
      return false;
    }

    const payload = buildDiscordPostPayload(siteId, config, post);
    const res = await safeOutboundFetch(
      config.webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { allowedDomains: ["discord.com", "discordapp.com"], timeoutMs: 10_000 }
    );

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
    const check = await validateOutboundUrl(webhookUrl, {
      allowedDomains: ["discord.com", "discordapp.com"],
    });
    if (!check.valid || !check.url.pathname.startsWith("/api/webhooks/")) {
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

    const res = await safeOutboundFetchValidated(
      check.url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { allowedDomains: ["discord.com", "discordapp.com"], timeoutMs: 10_000 }
    );

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
