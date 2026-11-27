import crypto from "crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { getSiteForHost, normalizeDomain } from "@/lib/tenant";
import { getRequestHost } from "@/lib/http/request";
import { getJwtSecretString } from "@/lib/config/secrets";
import { getEnvConfig, isProductionEnv, isSingleTenantFallbackEnabled } from "@/lib/config/env";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/** Result of resolving the tenant allowed to receive an analytics event. */
export type AnalyticsSiteResolution =
  | { ok: true; siteId: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

function isLocalAnalyticsHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

/**
 * Resolves which tenant may record an analytics event for the current host.
 *
 * The incoming `Host` header is authoritative when it maps to a registered
 * site. A client-supplied `siteId` is only accepted when it matches that host,
 * so telemetry cannot be inflated for another tenant. Unknown hosts fail closed
 * in production; local development and deployments that explicitly enable the
 * single-tenant fallback still allow a registered site ID.
 *
 * @param requestedSiteId - Tenant identifier supplied by the browser beacon.
 * @returns Authorized site ID or a status/error pair describing the rejection.
 */
export async function resolveAnalyticsSite(
  requestedSiteId: string
): Promise<AnalyticsSiteResolution> {
  const siteId = requestedSiteId?.trim();
  if (!siteId || siteId.length > 128) {
    return { ok: false, status: 400, error: "Invalid site ID" };
  }

  const hostSite = await getSiteForHost();
  if (hostSite) {
    if (hostSite.id !== siteId) {
      return { ok: false, status: 403, error: "Site mismatch for request host" };
    }
    return { ok: true, siteId };
  }

  let host = "";
  try {
    host = normalizeDomain(getRequestHost(await headers()));
  } catch {
    // headers() is unavailable outside a request scope; treat as unknown host.
  }

  if (isProductionEnv() && !isLocalAnalyticsHost(host) && !isSingleTenantFallbackEnabled()) {
    return { ok: false, status: 404, error: "Unknown site for request host" };
  }

  const exists = getDb()
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, siteId))
    .get();

  if (!exists) {
    return { ok: false, status: 404, error: "Unknown site" };
  }

  return { ok: true, siteId };
}

/**
 * Normalizes an edge-provided country header to a two-letter ISO-3166 alpha-2 code.
 *
 * @param value - Raw `CF-IPCountry` / `X-Vercel-IP-Country` value.
 * @returns Uppercase country code, or `undefined` when absent or malformed.
 */
export function normalizeCountryCode(value: string | null | undefined): string | undefined {
  const code = (value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

/**
 * Accepts a country code only when the process trusts a reverse proxy.
 * Without `TRUSTED_PROXY_IPS`, country headers are caller-controlled and are stored empty.
 *
 * @param headerValues - Candidate country headers, first match wins.
 * @returns A two-letter code, or `undefined` when proxies are untrusted or the value is malformed.
 */
export function resolveAnalyticsCountry(...headerValues: Array<string | null | undefined>): string | undefined {
  if (getEnvConfig().trustedProxyIps.length === 0) return undefined;
  for (const value of headerValues) {
    const code = normalizeCountryCode(value);
    if (code) return code;
  }
  return undefined;
}

/**
 * Applies the global per-IP analytics rate limit for a beacon endpoint.
 *
 * @param scope - Endpoint name (`hit`, `heartbeat`, `pixel`) used in the key.
 * @param clientIp - Resolved client IP address.
 * @returns Rate limit evaluation with `allowed` and `retryAfter`.
 */
export function checkAnalyticsIpRateLimit(
  scope: string,
  clientIp: string
): { allowed: boolean; remaining: number; retryAfter: number } {
  return checkRateLimit(`analytics:${scope}:ip:${clientIp}`, RATE_LIMITS.analytics);
}

/**
 * Applies a per-site rate limit so traffic for one tenant cannot exhaust the
 * global IP budget of another tenant on the same origin.
 *
 * @param scope - Endpoint name used in the key.
 * @param clientIp - Resolved client IP address.
 * @param siteId - Validated tenant identifier.
 * @returns Rate limit evaluation with `allowed` and `retryAfter`.
 */
export function checkAnalyticsSiteRateLimit(
  scope: string,
  clientIp: string,
  siteId: string
): { allowed: boolean; remaining: number; retryAfter: number } {
  return checkRateLimit(`analytics:${scope}:site:${siteId}:${clientIp}`, RATE_LIMITS.analytics);
}

/**
 * Builds a stable, non-reversible visitor pseudonym from the client IP and user agent.
 *
 * Uses HMAC with the server signing secret so the stored hash cannot be reversed
 * by enumerating the small IPv4 address space. Only the first 128 bits are kept.
 *
 * @param clientIp - Resolved client IP address.
 * @param userAgent - Raw user agent string.
 * @returns Truncated HMAC-SHA256 hex digest.
 */
export function hashAnalyticsVisitor(clientIp: string, userAgent: string): string {
  return crypto
    .createHmac("sha256", getJwtSecretString())
    .update(`${clientIp}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Normalizes a campaign token before it is stored or embedded in an analytics path.
 *
 * @param value - Raw campaign source supplied by query string or payload.
 * @param fallback - Value returned when the cleaned token is empty.
 * @returns URL-safe token bounded to 64 characters.
 */
export function sanitizeCampaignToken(value: string | null | undefined, fallback = "newsletter"): string {
  const cleaned = (value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}
