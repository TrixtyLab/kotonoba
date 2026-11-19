import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/security/crypto";
import { safeOutboundFetch, validateOutboundUrl } from "@/lib/security/ssrf";

/**
 * Built-in allowlist of official OpenAI-compatible SaaS API hosts permitted for tenant admins.
 * Custom self-hosted endpoints are restricted to super administrators.
 */
const ALLOWED_AI_PROVIDER_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "openrouter.ai",
  "api.groq.com",
  "api.mistral.ai",
  "api.deepseek.com",
];

/**
 * Normalizes a base AI endpoint URL into a concrete `/chat/completions` URL string.
 *
 * @param rawInput - Base or full chat-completions endpoint URL.
 * @returns Normalized HTTPS endpoint URL string.
 */
export function resolveAiChatEndpoint(rawInput?: string | null): string {
  let rawUrl = (rawInput || "https://api.openai.com/v1").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    rawUrl = `https://${rawUrl}`;
  }
  let endpoint = rawUrl.replace(/\/+$/, "");
  if (!endpoint.endsWith("/chat/completions")) {
    if (endpoint === "https://api.openai.com" || endpoint === "http://api.openai.com") {
      endpoint = `${endpoint}/v1/chat/completions`;
    } else {
      endpoint = `${endpoint}/chat/completions`;
    }
  }
  return endpoint;
}

/**
 * Checks whether a candidate AI endpoint URL targets a permitted built-in provider domain.
 *
 * @param endpointUrl - Normalized endpoint URL.
 * @returns `true` if hostname matches `ALLOWED_AI_PROVIDER_DOMAINS`.
 */
export function isBuiltInAiProviderUrl(endpointUrl: string): boolean {
  try {
    const parsed = new URL(endpointUrl);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_AI_PROVIDER_DOMAINS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Decrypted AI assistant connection configuration parameters.
 */
export interface AiConfig {
  /** Target API endpoint URL (e.g., 'https://api.openai.com/v1'). */
  apiUrl: string;
  /** Decrypted secret API authentication key. */
  apiKey: string;
  /** Target AI model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet'). */
  model: string;
  /** Sampling temperature between 0.0 and 2.0. */
  temperature: number;
  /** Master toggle enabling or disabling AI features for the site. */
  enabled: boolean;
}

/**
 * Retrieves and decrypts the site-specific AI integration parameters from SQLite settings.
 *
 * @param siteId - Unique identifier of the tenant site.
 * @returns A Promise resolving to the resolved and decrypted AiConfig object.
 */
async function getAiConfig(siteId: string): Promise<AiConfig> {
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
 * Parses and extracts text content from an AI provider response, supporting both standard
 * JSON chat completion responses and Server-Sent Events (SSE) streaming chunks.
 *
 * @param responseText - Raw response text string from the AI endpoint.
 * @returns The extracted message content string.
 */
export function extractAiResponseText(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("data:") || trimmed.includes("\ndata:") || trimmed.includes("\r\ndata:")) {
    const lines = trimmed.split(/\r?\n/);
    let accumulated = "";
    let parsedAnyChunk = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const dataContent = line.slice(5).trim();
      if (!dataContent || dataContent === "[DONE]") continue;

      try {
        const chunk = JSON.parse(dataContent);
        parsedAnyChunk = true;

        if (chunk.error?.message) {
          throw new Error(chunk.error.message);
        }

        const delta = chunk.choices?.[0]?.delta;
        const message = chunk.choices?.[0]?.message;
        const text = chunk.choices?.[0]?.text;

        if (typeof delta?.content === "string") {
          accumulated += delta.content;
        } else if (typeof message?.content === "string") {
          accumulated += message.content;
        } else if (typeof text === "string") {
          accumulated += text;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== dataContent && dataContent.includes('"error"')) {
          throw e;
        }
      }
    }

    if (parsedAnyChunk) {
      return accumulated;
    }
  }

  try {
    const json = JSON.parse(trimmed);
    if (json.error?.message) {
      throw new Error(json.error.message);
    }
    const choice = json.choices?.[0];
    if (typeof choice?.message?.content === "string") {
      return choice.message.content;
    }
    if (typeof choice?.delta?.content === "string") {
      return choice.delta.content;
    }
    if (typeof choice?.text === "string") {
      return choice.text;
    }
    if (typeof json.response === "string") {
      return json.response;
    }
    if (typeof json.content === "string") {
      return json.content;
    }
    return "";
  } catch (err) {
    if (err instanceof Error && !err.message.includes("Unexpected token") && !err.message.includes("JSON")) {
      throw err;
    }
    throw new Error(`Invalid JSON returned from AI provider: ${trimmed.slice(0, 150)}`);
  }
}

/**
 * Executes an HTTP chat completion request against any OpenAI-compatible AI API endpoint.
 *
 * @param siteId - Unique identifier of the tenant site owning the AI configuration.
 * @param messages - Array of conversation messages comprising role and text content.
 * @param overrideConfig - Optional partial AI settings to override saved site configuration.
 * @returns A Promise resolving to the text response generated by the language model.
 * @throws {Error} When AI features are disabled, API key is missing, or the upstream API responds with an error code.
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

  const endpoint = resolveAiChatEndpoint(config.apiUrl);
  const urlCheck = await validateOutboundUrl(endpoint);
  if (!urlCheck.valid) {
    throw new Error(`Invalid AI endpoint URL: ${urlCheck.error}`);
  }

  const res = await safeOutboundFetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`,
        "HTTP-Referer": "https://kotonoba.cms",
        "X-Title": "Kotonoba CMS",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        stream: false,
      }),
    },
    { timeoutMs: 25_000 }
  );

  const responseText = await res.text();

  if (!res.ok) {
    let errorDetail = responseText;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.error?.message) errorDetail = parsed.error.message;
    } catch {}
    throw new Error(`AI API call failed (HTTP ${res.status}): ${errorDetail}`);
  }

  return extractAiResponseText(responseText);
}
