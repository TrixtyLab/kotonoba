import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import {
  encryptSecret,
  decryptSecret,
  decryptSecretOrLegacyPlaintext,
  isEncryptedSecret,
  maskSecretHint,
} from "@/lib/security/crypto";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { safeOutboundFetch, validateOutboundUrl } from "@/lib/security/ssrf";
import { recordAuditEvent } from "@/lib/security/audit";
import { SECRET_SETTING_KEYS, ALLOWED_SETTINGS_KEYS } from "@/lib/config/settings-keys";
import { extractAiResponseText, isBuiltInAiProviderUrl, resolveAiChatEndpoint } from "@/lib/ai/client";

/** Parameter payload for saving AI assistant integration settings. */
export interface AiSettingsInput {
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  enabled?: boolean;
}

/** Result payload returned from settings mutation operations. */
export type SettingsMutationResponse = { success: true } | { success: false; error?: string };

/** Result payload returned from an AI endpoint connectivity probe. */
export type AiTestConnectionResponse = { success: true; reply?: string } | { success: false; error: string };

async function validateAndTransformSettingValue(
  key: string,
  rawValue: string,
  actorRole: string
): Promise<{ ok: true; skip?: boolean; value: string } | { ok: false; error: string }> {
  const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  const trimmed = value.trim();

  if (SECRET_SETTING_KEYS.has(key)) {
    if (!trimmed) {
      return { ok: true, skip: true, value: "" };
    }

    if (key === "discord_webhook_url" && !isEncryptedSecret(trimmed)) {
      const check = await validateOutboundUrl(trimmed, {
        allowedDomains: ["discord.com", "discordapp.com"],
      });
      if (!check.valid || !check.url.pathname.startsWith("/api/webhooks/")) {
        return { ok: false, error: "Invalid Discord webhook URL (must target https://discord.com/api/webhooks/...)." };
      }
      return { ok: true, value: encryptSecret(check.url.toString()) };
    }

    return { ok: true, value: isEncryptedSecret(trimmed) ? trimmed : encryptSecret(trimmed) };
  }

  if (key === "ai_api_url" && trimmed) {
    const endpoint = resolveAiChatEndpoint(trimmed);
    if (actorRole !== "super_admin" && !isBuiltInAiProviderUrl(endpoint)) {
      return { ok: false, error: "Custom AI endpoints require super administrator permissions." };
    }
    const check = await validateOutboundUrl(endpoint);
    if (!check.valid) {
      return { ok: false, error: `Invalid AI API URL: ${check.error}` };
    }
    return { ok: true, value: trimmed };
  }

  if (key === "bluesky_service_url" && trimmed) {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const check = await validateOutboundUrl(normalized);
    if (!check.valid) {
      return { ok: false, error: `Invalid Bluesky service URL: ${check.error}` };
    }
    return { ok: true, value: check.url.toString().replace(/\/+$/, "") };
  }

  if (key === "s3_endpoint" && trimmed) {
    const check = await validateOutboundUrl(trimmed);
    if (!check.valid) {
      return { ok: false, error: `Invalid S3/R2 endpoint URL: ${check.error}` };
    }
    return { ok: true, value: check.url.toString().replace(/\/+$/, "") };
  }

  if (key === "s3_public_url" && trimmed) {
    const safeUrl = sanitizeUrl(trimmed, { allowRelative: false });
    if (!safeUrl) {
      return { ok: false, error: "Invalid S3 public URL." };
    }
    return { ok: true, value: safeUrl.replace(/\/+$/, "") };
  }

  if (
    (key === "discord_bot_avatar" ||
      key === "header_banner_image" ||
      key === "header_banner_link" ||
      key === "header_banner_scheduled_image" ||
      key === "header_banner_scheduled_link") &&
    trimmed
  ) {
    const safeUrl = sanitizeUrl(trimmed, { allowRelative: true });
    if (!safeUrl) {
      return { ok: false, error: `Unsafe URL supplied for ${key}.` };
    }
    return { ok: true, value: safeUrl };
  }

  if (key === "sidebar_banners" && trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: "Invalid sidebar_banners format." };
      }
      const cleaned = parsed
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => {
          const safeImg = sanitizeUrl(typeof item.imageUrl === "string" ? item.imageUrl : "", { allowRelative: true });
          const safeLink = sanitizeUrl(typeof item.linkUrl === "string" ? item.linkUrl : "", { allowRelative: true });
          return {
            id: typeof item.id === "string" ? item.id.slice(0, 64) : undefined,
            imageUrl: safeImg || "",
            linkUrl: safeLink || "",
            target: item.target === "_self" ? "_self" : "_blank",
            alt: typeof item.alt === "string" ? item.alt.slice(0, 300) : "",
          };
        })
        .filter((item) => item.imageUrl.length > 0);
      return { ok: true, value: JSON.stringify(cleaned) };
    } catch {
      return { ok: false, error: "Invalid sidebar_banners JSON." };
    }
  }

  return { ok: true, value };
}

export async function saveSiteSettingsService(
  actor: TokenPayload,
  siteId: string,
  keyValuePairs: Record<string, string>
): Promise<SettingsMutationResponse> {
  const db = getDb();
  const entries = Object.entries(keyValuePairs);

  for (const [key] of entries) {
    if (!ALLOWED_SETTINGS_KEYS.has(key)) {
      return { success: false, error: `Unsupported configuration key: ${key}` };
    }
  }

  const processed: Array<{ key: string; value: string }> = [];
  let touchedSensitive = false;

  for (const [key, value] of entries) {
    const check = await validateAndTransformSettingValue(key, value, actor.role);
    if (!check.ok) {
      return { success: false, error: check.error };
    }
    if (check.skip) continue;
    if (SECRET_SETTING_KEYS.has(key) || key === "ai_api_url" || key === "storage_provider" || key === "s3_endpoint") {
      touchedSensitive = true;
    }
    processed.push({ key, value: check.value });
  }

  for (const { key, value } of processed) {
    const existing = db
      .select()
      .from(settings)
      .where(and(eq(settings.siteId, siteId), eq(settings.key, key)))
      .get();

    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.id, existing.id)).run();
    } else {
      db.insert(settings).values({ siteId, key, value }).run();
    }
  }

  if (touchedSensitive) {
    recordAuditEvent({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      siteId,
      action: "settings.update_sensitive",
      targetType: "settings",
      targetId: siteId,
      metadata: { keys: processed.map((p) => p.key) },
    });
  }

  return { success: true };
}

export function clearSiteSecretSettingService(
  actor: TokenPayload,
  siteId: string,
  key: "ai_api_key" | "discord_webhook_url" | "bluesky_app_password" | "s3_secret_key"
): SettingsMutationResponse {
  if (!SECRET_SETTING_KEYS.has(key)) {
    return { success: false, error: "Invalid secret key" };
  }

  const db = getDb();
  db.delete(settings).where(and(eq(settings.siteId, siteId), eq(settings.key, key))).run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId,
    action: "settings.clear_secret",
    targetType: "settings",
    targetId: siteId,
    metadata: { key },
  });

  return { success: true };
}

export async function testAiConnectionService(
  actor: TokenPayload,
  siteId: string,
  input: { apiUrl?: string; apiKey?: string; model?: string }
): Promise<AiTestConnectionResponse> {
  const db = getDb();
  let effectiveKey = input.apiKey?.trim();

  if (!effectiveKey && siteId) {
    const row = db
      .select()
      .from(settings)
      .where(and(eq(settings.siteId, siteId), eq(settings.key, "ai_api_key")))
      .get();
    if (row?.value) {
      effectiveKey = decryptSecret(row.value);
    }
  }

  if (!effectiveKey) {
    return { success: false, error: "API Key is required to test the connection." };
  }

  const endpoint = resolveAiChatEndpoint(input.apiUrl);
  const urlCheck = await validateOutboundUrl(endpoint);
  if (!urlCheck.valid) {
    return { success: false, error: `Invalid AI API URL: ${urlCheck.error}` };
  }
  if (actor.role !== "super_admin" && !isBuiltInAiProviderUrl(endpoint)) {
    return { success: false, error: "Custom AI endpoints require super administrator permissions." };
  }

  const model = input.model?.trim() || "gpt-4o";

  try {
    const payload: {
      model: string;
      messages: Array<{ role: "user"; content: string }>;
      stream: boolean;
      max_tokens?: number;
    } = {
      model,
      messages: [{ role: "user", content: "Ping. Reply with 'pong'." }],
      stream: false,
    };

    if (!model.toLowerCase().startsWith("o1") && !model.toLowerCase().startsWith("o3")) {
      payload.max_tokens = 10;
    }

    const res = await safeOutboundFetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveKey}`,
          "HTTP-Referer": "https://kotonoba.cms",
          "X-Title": "Kotonoba CMS",
        },
        body: JSON.stringify(payload),
      },
      { timeoutMs: 20_000 }
    );

    const responseText = await res.text();
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${responseText}`;
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message) {
          errorMsg = `HTTP ${res.status}: ${errorJson.error.message}`;
        }
      } catch {
        if (responseText.includes("<html") || responseText.includes("<!DOCTYPE")) {
          errorMsg = `HTTP ${res.status}: Endpoint returned HTML instead of JSON. Check the URL (${endpoint}).`;
        }
      }
      return { success: false, error: errorMsg };
    }

    const reply = extractAiResponseText(responseText);
    return { success: true, reply };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach AI endpoint.";
    return { success: false, error: message };
  }
}

export function getRedactedSiteSettings(siteId: string): Record<string, string> {
  const db = getDb();
  const rows = db.select().from(settings).where(eq(settings.siteId, siteId)).all();
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  for (const secretKey of SECRET_SETTING_KEYS) {
    const rawValue = map[secretKey];
    if (rawValue !== undefined) {
      const decrypted = decryptSecretOrLegacyPlaintext(rawValue);
      map[`has_${secretKey}`] = decrypted ? "true" : "false";
      map[`${secretKey}_masked`] = decrypted ? maskSecretHint(decrypted) : "";
      delete map[secretKey];
    }
  }

  return map;
}

/** Reads and decrypts a single stored secret setting for server-only integration helpers. */
export function getDecryptedSiteSecret(siteId: string, key: string): string {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.siteId, siteId), eq(settings.key, key)))
    .get();
  return row?.value ? decryptSecretOrLegacyPlaintext(row.value).trim() : "";
}
