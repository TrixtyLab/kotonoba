/**
 * Sanitizes and normalizes media asset URLs, stripping transient query parameters
 * from local storage proxies (/api/uploads/...) and extracting persistent local proxy paths
 * from legacy full-domain S3/R2/local URLs.
 *
 * @param {string | null | undefined} url - Raw media asset URL.
 * @returns {string} Sanitized, persistent proxy URL.
 */
export function normalizeMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("/api/uploads/")) {
    return trimmed.split("?")[0];
  }

  const apiUploadsMatch = trimmed.match(/^https?:\/\/[^/]+(\/api\/uploads\/[^?#]+)/i);
  if (apiUploadsMatch && apiUploadsMatch[1]) {
    return apiUploadsMatch[1];
  }

  const uploadsMatch = trimmed.match(/^https?:\/\/[^/]+(\/uploads\/[^?#]+)/i);
  if (uploadsMatch && uploadsMatch[1]) {
    return `/api${uploadsMatch[1]}`;
  }

  const staticSvgMatch = trimmed.match(/^https?:\/\/[^/]+(\/(?:icon|logo)\.svg)/i);
  if (staticSvgMatch && staticSvgMatch[1]) {
    return staticSvgMatch[1];
  }

  const r2OrS3Match = trimmed.match(/^https?:\/\/[^/]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^?#]+)/i);
  if (r2OrS3Match && r2OrS3Match[1]) {
    const rawPath = decodeURIComponent(r2OrS3Match[1]).replace(/^\/+/, "");
    return `/api/uploads/${rawPath}`;
  }

  return trimmed;
}

/**
 * Resolves an absolute HTTP URL from a potentially relative asset path or local endpoint.
 *
 * @param {string | null | undefined} urlOrPath - Relative asset path, relative URL (/api/uploads/...), or full URL.
 * @param {string} baseUrl - Canonical site base URL (e.g., https://kagarisoft.unsetsoft.com).
 * @returns {string | undefined} Fully qualified absolute URL or undefined.
 */
export function resolveAbsoluteUrl(urlOrPath: string | null | undefined, baseUrl: string): string | undefined {
  if (!urlOrPath) return undefined;
  const cleanPath = normalizeMediaUrl(urlOrPath);
  if (!cleanPath) return undefined;
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }
  const cleanBase = baseUrl.replace(/\/$/, "");
  const formattedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  return `${cleanBase}${formattedPath}`;
}

/**
 * Normalizes all legacy S3/R2 presigned image URLs inside HTML or Markdown strings to /api/uploads/...
 *
 * @param {string} content - Raw HTML or Markdown string.
 * @returns {string} Sanitized content with permanent proxy URLs.
 */
export function normalizeHtmlMediaUrls(content: string): string {
  if (!content) return "";
  let updated = content;

  updated = updated.replace(
    /https?:\/\/[^\s"'<>]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^\s"'<>?#)]+)(?:\?[^\s"'<>)]*)?/gi,
    (_match, rawKey) => {
      const cleanKey = decodeURIComponent(rawKey).replace(/^\/+/, "");
      return `/api/uploads/${cleanKey}`;
    }
  );

  updated = updated.replace(
    /(?:https?:\/\/[^\s"'<>]+)?\/api\/uploads\/([^\s"'<>?#)]+)(?:\?[^\s"'<>)]*)?/gi,
    (_match, rawKey) => {
      const cleanKey = decodeURIComponent(rawKey).replace(/^\/+/, "");
      return `/api/uploads/${cleanKey}`;
    }
  );

  return updated;
}
