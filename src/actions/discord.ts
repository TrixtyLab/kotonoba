"use server";

import { ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { sendDiscordTestNotification } from "@/lib/discord";
import { getDecryptedSiteSecret } from "@/lib/services/settings";
import { getSiteById } from "@/lib/services/sites";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Tests Discord webhook connectivity using the candidate URL or stored encrypted secret.
 */
export async function testDiscordWebhookAction(
  siteId: string,
  webhookUrl?: string
): Promise<{ success: boolean; error?: string }> {
  await requireSiteAccess(siteId, ROLE_PUBLISHERS);

  const effectiveWebhook = webhookUrl?.trim() || getDecryptedSiteSecret(siteId, "discord_webhook_url");
  if (!effectiveWebhook) {
    return { success: false, error: "Discord Webhook URL is required to run the test." };
  }

  const site = getSiteById(siteId);
  return await sendDiscordTestNotification(effectiveWebhook, {
    name: getLocalizedText(site?.name, site?.locale || "en"),
    logoUrl: site?.logoUrl || site?.faviconUrl || undefined,
    primaryColor: site?.primaryColor || undefined,
  });
}
