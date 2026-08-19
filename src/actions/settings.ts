"use server";

import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { encryptSecret, decryptSecret } from "@/lib/security/crypto";
import { revalidatePath } from "next/cache";

/**
 * Parameter payload for saving AI assistant integration settings.
 */
export interface AiSettingsInput {
  /** Target API endpoint URL. */
  apiUrl?: string;
  /** Plaintext API secret key to encrypt before storage. */
  apiKey?: string;
  /** Language model identifier. */
  model?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Active status toggle. */
  enabled?: boolean;
}

/**
 * Result payload returned from settings mutation operations.
 */
export type SettingsMutationResponse =
  | { success: true }
  | { success: false; error?: string };

/**
 * Result payload returned from an AI endpoint connectivity probe.
 */
export type AiTestConnectionResponse =
  | { success: true; reply?: string }
  | { success: false; error: string };

/**
 * Upserts key-value configuration pairs associated with a specific tenant site.
 * Automatically triggers cache revalidation for the site's layout tree.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param keyValuePairs - Dictionary of configuration keys and string values.
 * @returns A Promise resolving to a SettingsMutationResponse.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function saveSiteSettings(
  siteId: string,
  keyValuePairs: Record<string, string>
): Promise<SettingsMutationResponse> {
  await requireAuth(["super_admin", "admin"]);
  const db = getDb();

  for (const [key, value] of Object.entries(keyValuePairs)) {
    const existing = db
      .select()
      .from(settings)
      .where(and(eq(settings.siteId, siteId), eq(settings.key, key)))
      .get();

    if (existing) {
      db.update(settings)
        .set({ value })
        .where(eq(settings.id, existing.id))
        .run();
    } else {
      db.insert(settings)
        .values({
          siteId,
          key,
          value,
        })
        .run();
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");
  return { success: true };
}

/**
 * Encrypts sensitive API keys using AES-256-GCM and persists AI assistant parameters to SQLite.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param input - AI configuration parameters.
 * @returns A Promise resolving to a SettingsMutationResponse.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function saveAiSettings(
  siteId: string,
  input: AiSettingsInput
): Promise<SettingsMutationResponse> {
  await requireAuth(["super_admin", "admin"]);

  const encryptedKey = input.apiKey ? encryptSecret(input.apiKey) : "";

  const payload: Record<string, string> = {
    ai_api_url: input.apiUrl || "https://api.openai.com/v1",
    ai_model: input.model || "gpt-4o",
    ai_temperature: String(input.temperature ?? 0.7),
    ai_enabled: String(input.enabled ?? false),
  };

  if (input.apiKey) {
    payload.ai_api_key = encryptedKey;
  }

  return saveSiteSettings(siteId, payload);
}

/**
 * Performs a test ping to an OpenAI-compatible endpoint to verify connectivity and API key validity.
 *
 * @param apiUrl - Target API endpoint URL.
 * @param apiKey - Candidate secret API key.
 * @param model - Model identifier string.
 * @returns A Promise resolving to an AiTestConnectionResponse with response reply or error message.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function testAiConnection(
  apiUrl: string,
  apiKey: string,
  model: string
): Promise<AiTestConnectionResponse> {
  await requireAuth(["super_admin", "admin"]);

  if (!apiUrl || !apiKey) {
    return { success: false, error: "API URL and API Key are required." };
  }

  try {
    const cleanUrl = apiUrl.replace(/\/+$/, "");
    const endpoint = `${cleanUrl}/chat/completions`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: [{ role: "user", content: "Ping. Reply with 'pong'." }],
        max_tokens: 10,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${err}` };
    }

    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content || "";
    return { success: true, reply };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI endpoint.";
    return { success: false, error: message };
  }
}

/**
 * Retrieves all stored key-value settings for a site with AI secret keys securely masked.
 *
 * @param siteId - Unique database identifier of the target site.
 * @returns A Promise resolving to a key-value dictionary with sensitive keys redacted.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function getSiteSettings(siteId: string): Promise<Record<string, string>> {
  await requireAuth(["super_admin", "admin"]);
  const db = getDb();
  const rows = db.select().from(settings).where(eq(settings.siteId, siteId)).all();
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  if (map.ai_api_key) {
    const decrypted = decryptSecret(map.ai_api_key);
    map.ai_api_key_masked = decrypted ? `${decrypted.slice(0, 4)}...${decrypted.slice(-4)}` : "";
    delete map.ai_api_key;
  }
  return map;
}
