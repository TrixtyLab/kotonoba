/**
 * Standard enterprise HTTP security headers applied across all responses.
 */
export const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;

/**
 * Appends standard production security headers to an outgoing Headers collection.
 *
 * @param headers - The mutable standard Fetch Headers instance to enrich with security policies.
 * @returns Void.
 */
export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
}
