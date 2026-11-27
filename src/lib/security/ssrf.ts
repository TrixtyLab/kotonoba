import dns from "dns/promises";
import net from "net";
import type { LookupFunction } from "net";
import { Agent, type Dispatcher } from "undici";
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

const RESERVED_IPV4_CIDRS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isPrivateIpv6(cleaned: string): boolean {
  if (cleaned === "::" || cleaned === "::1") return true;
  if (cleaned.startsWith("fc") || cleaned.startsWith("fd") || cleaned.startsWith("ff")) return true;
  return cleaned.startsWith("fe8") || cleaned.startsWith("fe9") || cleaned.startsWith("fea") || cleaned.startsWith("feb");
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
  if (cleaned.startsWith("::ffff:")) return isPrivateOrReservedIp(cleaned.slice(7));

  const version = net.isIP(cleaned);
  if (version === 4) return RESERVED_IPV4_CIDRS.some(([base, prefix]) => inIpv4Cidr(cleaned, base, prefix));
  if (version === 6) return isPrivateIpv6(cleaned);
  return true;
}

function matchesAllowedDomains(hostname: string, allowedDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const target = domain.trim().toLowerCase();
    return lower === target || lower.endsWith(`.${target}`);
  });
}

function isBlockedHostname(hostname: string): boolean {
  return !hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal");
}

async function resolvePublicDnsIps(parsed: URL, hostname: string): Promise<OutboundUrlCheckResult> {
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

function parsePermittedUrl(rawUrl: string, allowHttpInDev?: boolean): { url: URL } | { error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { error: "URL is required" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Invalid URL format" };
  }

  const allowHttp = Boolean(allowHttpInDev && !isProductionEnv());
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    return { error: "Only HTTPS URLs are permitted" };
  }
  if (parsed.username || parsed.password) return { error: "Embedded URL credentials are not permitted" };
  return { url: parsed };
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
  const precheck = parsePermittedUrl(rawUrl, options.allowHttpInDev);
  if ("error" in precheck) return { valid: false, error: precheck.error };
  const parsed = precheck.url;

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (isBlockedHostname(hostname)) return { valid: false, error: "Destination hostname is not permitted" };
  if (options.allowedDomains?.length && !matchesAllowedDomains(hostname, options.allowedDomains)) {
    return { valid: false, error: "Destination domain is not in the permitted allowlist" };
  }

  if (net.isIP(hostname.replace(/^\[|\]$/g, ""))) {
    return isPrivateOrReservedIp(hostname)
      ? { valid: false, error: "Private or reserved IP destinations are not permitted" }
      : { valid: true, url: parsed, resolvedIps: [hostname] };
  }
  if (options.skipDnsLookup) return { valid: true, url: parsed, resolvedIps: [] };
  return resolvePublicDnsIps(parsed, hostname);
}

/**
 * DNS lookup that always returns one already-validated public address.
 * The original hostname stays on the request for Host and TLS SNI.
 *
 * @param address - Public IP chosen during {@link validateOutboundUrl}.
 * @returns A lookup function for undici's connect options.
 */
export function pinnedDnsLookup(address: string): LookupFunction {
  const family = net.isIP(address) === 6 ? 6 : 4;
  return ((
    _hostname: string,
    options: unknown,
    callback?: (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void
  ) => {
    const cb = typeof options === "function" ? options : callback;
    if (!cb) return;
    const all =
      typeof options === "object" &&
      options !== null &&
      "all" in options &&
      Boolean((options as { all?: boolean }).all);
    if (all) {
      cb(null, [{ address, family }]);
      return;
    }
    cb(null, address, family);
  }) as LookupFunction;
}

/**
 * Executes `fetch` after SSRF validation.
 * The socket is pinned to the first validated public IP. Host and SNI stay on the original URL.
 * Redirects are not followed.
 *
 * @param rawUrl - Destination URL string.
 * @param init - Standard `RequestInit` options.
 * @param options - SSRF validation options plus optional timeout in milliseconds (default 10s).
 * @returns HTTP `Response` from `fetch`.
 * @throws {Error} When SSRF validation fails, no public IP was pinned, or a redirect occurs.
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

  const pinnedIp = check.resolvedIps[0];
  if (!pinnedIp) {
    throw new Error("Outbound destination has no validated address");
  }

  const timeoutMs = options.timeoutMs ?? 10_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([timeoutSignal, init.signal]) : timeoutSignal;
  const agent = new Agent({
    connect: {
      lookup: pinnedDnsLookup(pinnedIp),
    },
  });

  try {
    const response = await fetch(check.url.toString(), {
      ...init,
      redirect: "manual",
      signal,
      dispatcher: agent,
    } as RequestInit & { dispatcher: Dispatcher });

    if (response.status >= 300 && response.status < 400) {
      throw new Error(`Outbound redirects are disabled for security (status ${response.status})`);
    }

    return response;
  } finally {
    await agent.close();
  }
}
