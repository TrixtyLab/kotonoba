import net from "net";
import { getEnvConfig } from "@/lib/config/env";

/**
 * Minimal header lookup contract satisfied by Web `Headers` and Next.js `ReadonlyHeaders`.
 */
export interface HeaderReadable {
  get(name: string): string | null;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Checks whether an IP address string belongs to a configured trusted reverse proxy.
 * Supports exact IPs and IPv4 CIDR blocks in `TRUSTED_PROXY_IPS`.
 */
function isTrustedProxyIp(ip: string | null | undefined, trustedList?: string[]): boolean {
  if (!ip) return false;
  const candidate = normalizeIp(ip);
  if (!net.isIP(candidate)) return false;

  const list = trustedList ?? getEnvConfig().trustedProxyIps;
  if (list.length === 0) return false;

  for (const rule of list) {
    const trimmed = rule.trim();
    if (!trimmed) continue;

    if (trimmed === "*") {
      return true;
    }

    if (trimmed.includes("/")) {
      const [baseIp, prefixStr] = trimmed.split("/");
      const prefix = Number.parseInt(prefixStr || "", 10);
      if (net.isIPv4(candidate) && net.isIPv4(baseIp) && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32) {
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        const candidateInt = ipv4ToInt(candidate);
        const baseInt = ipv4ToInt(baseIp);
        if ((candidateInt & mask) === (baseInt & mask)) {
          return true;
        }
      }
      continue;
    }

    if (normalizeIp(trimmed) === candidate) {
      return true;
    }
  }

  return false;
}

function ipv4ToInt(ip: string): number {
  const octets = ip.split(".").map((part) => Number.parseInt(part, 10));
  return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
}

/**
 * Extracts the client IP address for rate limiting and analytics deduplication.
 *
 * When `TRUSTED_PROXY_IPS` is configured, forwarded headers (`x-forwarded-for`,
 * `x-real-ip`, `cf-connecting-ip`) are read from the right-most untrusted hop or
 * validated header. When no trusted proxies are configured in production,
 * `x-real-ip` (which nginx overwrites via `$remote_addr`) is preferred over arbitrary
 * client-supplied `x-forwarded-for` hops when present.
 *
 * @param headers - Request header collection.
 * @returns Normalized client IP or `"unknown"`.
 */
export function getClientIp(headers: HeaderReadable): string {
  const realIp = normalizeIp(headers.get("x-real-ip") || "");
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const cfConnectingIp = normalizeIp(headers.get("cf-connecting-ip") || "");
  const trustedProxies = getEnvConfig().trustedProxyIps;

  if (trustedProxies.length > 0) {
    if (cfConnectingIp && net.isIP(cfConnectingIp)) {
      return cfConnectingIp;
    }

    const hops = forwardedFor
      .split(",")
      .map((part) => normalizeIp(part))
      .filter((part) => net.isIP(part) !== 0);

    if (hops.length > 0) {
      for (let i = hops.length - 1; i >= 0; i -= 1) {
        if (!isTrustedProxyIp(hops[i], trustedProxies)) {
          return hops[i];
        }
      }
      return hops[0];
    }

    if (realIp && net.isIP(realIp)) {
      return realIp;
    }
  }

  // Fallback for standard single nginx reverse proxy (`proxy_set_header X-Real-IP $remote_addr`).
  if (realIp && net.isIP(realIp)) {
    return realIp;
  }

  if (forwardedFor) {
    const firstValid = forwardedFor
      .split(",")
      .map((part) => normalizeIp(part))
      .find((part) => net.isIP(part) !== 0);
    if (firstValid) {
      return firstValid;
    }
  }

  return "unknown";
}

/**
 * Resolves the effective request host stripped of port when normalizing hostnames,
 * or lowercased with port preserved for tenant domain lookup.
 *
 * @param headers - Incoming HTTP headers.
 * @returns Normalized `host` header value, preferring `x-forwarded-host` only when
 * `TRUSTED_PROXY_IPS` is configured or local proxy headers match `host`.
 */
export function getRequestHost(headers: HeaderReadable): string {
  const hostHeader = headers.get("host")?.split(",")[0]?.trim().toLowerCase() || "";
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase() || "";
  const trustedProxies = getEnvConfig().trustedProxyIps;

  if (forwardedHost && (trustedProxies.length > 0 || !hostHeader)) {
    return forwardedHost;
  }
  return hostHeader || forwardedHost || "localhost:3000";
}

/**
 * Verifies same-origin state-changing HTTP requests (`Origin` / `Referer` vs request host).
 *
 * @param headers - Request header collection.
 * @returns `true` when origin matches host or no cross-site Origin is supplied.
 */
export function isSameOriginRequest(headers: HeaderReadable): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");
  const expectedHost = getRequestHost(headers).split(":")[0];

  const sourceUrl = origin || referer;
  if (!sourceUrl) {
    // Allow non-browser same-site callers only when explicit Fetch Metadata does not indicate cross-site.
    const fetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();
    return fetchSite !== "cross-site";
  }

  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}
