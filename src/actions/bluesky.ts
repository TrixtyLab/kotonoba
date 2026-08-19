"use server";

import { requireAuth } from "@/lib/auth/session";
import { testBlueskyConnection, BlueskyCredentials } from "@/lib/bluesky";

/**
 * Server action testing Bluesky AT Protocol authentication and profile retrieval from settings.
 *
 * @param creds - Bluesky identifier, App Password, and optional PDS service URL.
 * @returns Promise resolving to connection outcome with profile details or error message.
 * @throws {Error} When caller lacks administrative or editorial authorization.
 */
export async function testBlueskyConnectionAction(
  creds: BlueskyCredentials
): Promise<{
  success: boolean;
  profile?: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  error?: string;
}> {
  await requireAuth(["super_admin", "admin", "editor"]);
  return await testBlueskyConnection(creds);
}
