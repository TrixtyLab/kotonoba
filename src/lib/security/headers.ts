/**
 * Standard HTTP security headers applied across application responses.
 */
export const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
} as const;

export interface BuildCspOptions {
  nonce: string;
  isDev?: boolean;
  isHttps?: boolean;
}

/**
 * Builds the strict Content-Security-Policy header value for per-request nonces.
 *
 * Uses strict `script-src` nonces without `'unsafe-inline'`, allows embedded media frames
 * matching `ALLOWED_IFRAME_HOSTNAMES`, and blocks `<object>` / framing clickjacking.
 *
 * @param options - Nonce and runtime transport context.
 * @returns Compact single-line CSP directive string.
 */
export function buildContentSecurityPolicy({ nonce, isDev = false, isHttps = false }: BuildCspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' https: http: blob:",
    "connect-src 'self' https:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://store.steampowered.com https://itch.io https://open.spotify.com https://platform.twitter.com https://embed.bsky.app",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
  ];

  if (isHttps) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/**
 * Resolves the active CSP header name (`Content-Security-Policy` vs `-Report-Only`) from `CSP_MODE`.
 */
export function getCspHeaderName(mode: "report-only" | "enforce" = "report-only"): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return mode === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

/**
 * Appends standard production security headers (and optional CSP) to an outgoing Headers collection.
 *
 * @param headers - Mutable Fetch Headers instance.
 * @param csp - Optional prebuilt CSP value & header name.
 */
export function applySecurityHeaders(
  headers: Headers,
  csp?: { headerName: "Content-Security-Policy" | "Content-Security-Policy-Report-Only"; value: string }
): void {
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
  if (csp) {
    headers.set(csp.headerName, csp.value);
  }
}
