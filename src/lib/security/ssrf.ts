import dns from "dns/promises";
import net from "net";
import { isProductionEnv } from "@/lib/config/env";

/**
 * Validation options for outbound HTTP(S) destinations.
 */
export interface OutboundUrlOptions {
  /** Optional list of permitted hostnames (exact match or subdomain). */
  allowedDomains?: string[];
  /** Explicit override allowing `http:` in non-production environments. */
  allowHttpInDev?: boolean;
  /** Skip DNS lookup (useful for unit tests that validate static IP/host rules). */
  skipDnsLookup?: boolean;
}

/**
 * Result of SSRF validation for an outbound URL.
 */
export type OutboundUrlCheckResult =
  | { valid: true; url: URL; resolvedIps: string[] }
  | { valid: false; error: string };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inIpv4Cidr(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/**
 * Determines whether an IPv4 or IPv6 literal belongs to a private, loopback,
 * link-local, metadata, carrier-grade NAT, or reserved non-routable range.
 *
 * @param ip - IP address literal.
 * @returns `true` if the IP must be blocked for outbound SSRF protection.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!cleaned) return true;

  if (cleaned.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(cleaned.slice(7));
  }

  const version = net.isIP(cleaned);
  if (version === 4) {
    return (
      inIpv4Cidr(cleaned, "0.0.0.0", 8) || // Current network
      inIpv4Cidr(cleaned, "10.0.0.0", 8) || // RFC1918
      inIpv4Cidr(cleaned, "100.64.0.0", 10) || // CGNAT
      inIpv4Cidr(cleaned, "127.0.0.0", 8) || // Loopback
      inIpv4Cidr(cleaned, "169.254.0.0", 16) || // Link-local & cloud metadata
      inIpv4Cidr(cleaned, "172.16.0.0", 12) || // RFC1918
      inIpv4Cidr(cleaned, "192.0.0.0", 24) || // IETF protocol assignments
      inIpv4Cidr(cleaned, "192.0.2.0", 24) || // TEST-NET-1
      inIpv4Cidr(cleaned, "192.168.0.0", 16) || // RFC1918
      inIpv4Cidr(cleaned, "198.18.0.0", 15) || // Benchmarking
      inIpv4Cidr(cleaned, "198.51.100.0", 24) || // TEST-NET-2
      inIpv4Cidr(cleaned, "203.0.113.0", 24) || // TEST-NET-3
      inIpv4Cidr(cleaned, "224.0.0.0", 4) || // Multicast
      inIpv4Cidr(cleaned, "240.0.0.0", 4) // Reserved / broadcast
    );
  }

  if (version === 6) {
    if (cleaned === "::" || cleaned === "::1") return true;
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true; // fc00::/7 ULA
    if (
      cleaned.startsWith("fe8") ||
      cleaned.startsWith("fe9") ||
      cleaned.startsWith("fea") ||
      cleaned.startsWith("feb")
    ) {
      return true; // fe80::/10 link-local
    }
    if (cleaned.startsWith("ff")) return true; // multicast
    return false;
  }

  return true;
}

function matchesAllowedDomains(hostname: string, allowedDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const target = domain.trim().toLowerCase();
    return lower === target || lower.endsWith(`.${target}`);
  });
}

/**
 * Validates an outbound URL against SSRF risks (scheme, domain allowlist, literal IP ranges,
 * and resolved DNS addresses).
 *
 * @param rawUrl - Destination URL string.
 * @param options - Optional scheme, domain allowlist, and DNS toggles.
 * @returns Validation result with normalized `URL` or explicit error reason.
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options: OutboundUrlOptions = {}
): Promise<OutboundUrlCheckResult> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "URL is required" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  const allowHttp = Boolean(options.allowHttpInDev && !isProductionEnv());
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    return { valid: false, error: "Only HTTPS URLs are permitted" };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "Embedded URL credentials are not permitted" };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { valid: false, error: "Destination hostname is not permitted" };
  }

  if (options.allowedDomains && options.allowedDomains.length > 0 && !matchesAllowedDomains(hostname, options.allowedDomains)) {
    return { valid: false, error: "Destination domain is not in the permitted allowlist" };
  }

  if (net.isIP(hostname.replace(/^\[|\]$/g, ""))) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: "Private or reserved IP destinations are not permitted" };
    }
    return { valid: true, url: parsed, resolvedIps: [hostname] };
  }

  if (options.skipDnsLookup) {
    return { valid: true, url: parsed, resolvedIps: [] };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      return { valid: false, error: "Unable to resolve destination hostname" };
    }

    const ips = records.map((record) => record.address);
    if (ips.some((ip) => isPrivateOrReservedIp(ip))) {
      return { valid: false, error: "Destination resolves to a private or reserved IP range" };
    }

    return { valid: true, url: parsed, resolvedIps: ips };
  } catch {
    return { valid: false, error: "DNS lookup failed for destination hostname" };
  }
}

/**
 * Executes a `fetch` call after performing SSRF validation with `redirect: "manual"`,
 * a strict abort timeout, and optional domain allowlist.
 *
 * @param rawUrl - Destination URL string.
 * @param init - Standard `RequestInit` options.
 * @param options - SSRF validation options plus optional timeout in milliseconds (default 10s).
 * @returns HTTP `Response` from `fetch`.
 * @throws {Error} When SSRF validation fails or redirect/timeout occurs.
 */
export async function safeOutboundFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: OutboundUrlOptions & { timeoutMs?: number } = {}
): Promise<Response> {
  const check = await validateOutboundUrl(rawUrl, options);
  if (!check.valid) {
    throw new Error(check.error);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(check.url.toString(), {
      ...init,
      redirect: "manual",
      signal: init.signal ?? controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error(`Outbound redirects are disabled for security (status ${response.status})`);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}
