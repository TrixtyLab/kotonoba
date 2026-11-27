"use server";

import { ROLE_ADMINS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateSiteShell } from "@/lib/cache/revalidate";
import {
  getRedactedSiteSettings,
  saveSiteSettingsService,
  testAiConnectionService,
  type AiSettingsInput,
  type AiTestConnectionResponse,
  type SettingsMutationResponse,
} from "@/lib/services/settings";

export type { AiSettingsInput, AiTestConnectionResponse, SettingsMutationResponse };

/** Saves allowlisted key-value settings, encrypting secrets and validating outbound URLs. */
export async function saveSiteSettings(
  siteId: string,
  keyValuePairs: Record<string, string>
): Promise<SettingsMutationResponse> {
  const actor = await requireSiteAccess(siteId, ROLE_ADMINS);
  const res = await saveSiteSettingsService(actor, siteId, keyValuePairs);
  if (res.success) revalidateSiteShell(siteId);
  return res;
}

/** Saves AI assistant settings including optional encrypted API key update. */
export async function saveAiSettings(siteId: string, input: AiSettingsInput): Promise<SettingsMutationResponse> {
  await requireSiteAccess(siteId, ROLE_ADMINS);

  const payload: Record<string, string> = {
    ai_api_url: input.apiUrl || "https://api.openai.com/v1",
    ai_model: input.model || "gpt-4o",
    ai_temperature: String(input.temperature ?? 0.7),
    ai_enabled: String(input.enabled ?? false),
  };
  if (input.apiKey && input.apiKey.trim()) {
    payload.ai_api_key = input.apiKey.trim();
  }

  return saveSiteSettings(siteId, payload);
}

/** Executes a live test request against the configured AI endpoint cleanly. */
export async function testAiConnection(
  siteId: string,
  input: { apiUrl?: string; apiKey?: string; model?: string }
): Promise<AiTestConnectionResponse> {
  const actor = await requireSiteAccess(siteId, ROLE_ADMINS);
  return testAiConnectionService(actor, siteId, input);
}

/** Retrieves site settings with all integration/storage secrets redacted (`has_*` & masked hints). */
export async function getSiteSettings(siteId: string): Promise<Record<string, string>> {
  await requireSiteAccess(siteId, ROLE_ADMINS);
  return getRedactedSiteSettings(siteId);
}
