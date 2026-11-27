/**
 * Builds an absolute `http(s)://` base URL from a site's stored `domain` column,
 * using HTTP for local loopback hosts and HTTPS for public domains.
 *
 * @param domain - Raw domain or host string (e.g. `blog.example.com` or `localhost:3000`).
 * @returns Fully qualified base URL without trailing slash.
 */
export function buildSiteBaseUrl(domain?: string | null): string {
  const cleaned = (domain || "localhost:3000")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  const hostname = cleaned.split(":")[0].toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  return `${isLocal ? "http" : "https"}://${cleaned}`;
}
