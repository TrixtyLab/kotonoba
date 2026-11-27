"use server";

import { ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { testBlueskyConnection, type BlueskyCredentials } from "@/lib/bluesky";
import { getDecryptedSiteSecret } from "@/lib/services/settings";
import { getAdminSite } from "@/lib/tenant";

/**
 * Tests Bluesky AT Protocol authentication and profile retrieval for the active tenant site.
 */
export async function testBlueskyConnectionAction(
  creds: Omit<BlueskyCredentials, "appPassword"> & { appPassword?: string; siteId?: string }
): Promise<{
  success: boolean;
  profile?: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  error?: string;
}> {
  const activeSite = creds.siteId ? { id: creds.siteId } : await getAdminSite();
  if (!activeSite?.id) {
    return { success: false, error: "Active site context is required." };
  }

  await requireSiteAccess(activeSite.id, ROLE_PUBLISHERS);

  const effectivePassword =
    creds.appPassword?.trim() || getDecryptedSiteSecret(activeSite.id, "bluesky_app_password");

  return await testBlueskyConnection({
    identifier: creds.identifier,
    appPassword: effectivePassword,
    serviceUrl: creds.serviceUrl,
  });
}
