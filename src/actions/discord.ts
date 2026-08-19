"use server";

import { requireAuth } from "@/lib/auth/session";
import { sendDiscordTestNotification } from "@/lib/discord";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Server action testing Discord Webhook integration from the settings dashboard.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param webhookUrl - Target Discord Webhook URL.
 * @returns Promise resolving to operation outcome status.
 * @throws {Error} When user is not authenticated as administrator or editor.
 */
export async function testDiscordWebhookAction(
  siteId: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth(["super_admin", "admin", "editor"]);

  const db = getDb();
  const site = db.select().from(sites).where(eq(sites.id, siteId)).get();

  return await sendDiscordTestNotification(webhookUrl, {
    name: site?.name,
    logoUrl: site?.logoUrl || site?.faviconUrl || undefined,
    primaryColor: site?.primaryColor || undefined,
  });
}
