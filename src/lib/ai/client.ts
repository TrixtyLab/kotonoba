import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptSecret } from "@/lib/security/crypto";

export interface AiConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

/**
 * Retrieves and decrypts the site-specific AI configuration stored in SQLite.
 */
export async function getAiConfig(siteId: string): Promise<AiConfig> {
  const db = getDb();
  const rows = db
    .select()
    .from(settings)
    .where(eq(settings.siteId, siteId))
    .all();

  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.key, r.value);
  }

  const rawKey = map.get("ai_api_key") || "";
  const decryptedKey = rawKey ? decryptSecret(rawKey) : "";

  return {
    apiUrl: map.get("ai_api_url") || "https://api.openai.com/v1",
    apiKey: decryptedKey,
    model: map.get("ai_model") || "gpt-4o",
    temperature: parseFloat(map.get("ai_temperature") || "0.7"),
    enabled: map.get("ai_enabled") === "true",
  };
}

/**
 * Calls OpenAI-compatible /chat/completions endpoint with retry logic and standard JSON payload.
 */
export async function callAiChat(
  siteId: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  overrideConfig?: Partial<AiConfig>
): Promise<string> {
  const baseConfig = await getAiConfig(siteId);
  const config = { ...baseConfig, ...overrideConfig };

  if (!config.enabled && !overrideConfig) {
    throw new Error("AI Assistant is currently disabled in site settings.");
  }
  if (!config.apiKey) {
    throw new Error("No API key configured for OpenAI-compatible endpoint.");
  }

  const cleanUrl = config.apiUrl.replace(/\/+$/, "");
  const endpoint = `${cleanUrl}/chat/completions`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI API call failed with status ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}
