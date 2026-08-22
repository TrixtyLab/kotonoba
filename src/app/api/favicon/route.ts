import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getSiteForHost, getActiveSite } from "@/lib/tenant";
import { getStorageConfig } from "@/lib/storage";

const MIME_MAP: Record<string, string> = {
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

const DEFAULT_SVG_FALLBACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <linearGradient id="iconAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8" />
      <stop offset="100%" stop-color="#4F46E5" />
    </linearGradient>
    <linearGradient id="iconCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
  </defs>
  <g transform="translate(14, 10)">
    <circle cx="80" cy="36" r="10" fill="url(#iconCyan)" />
    <rect x="68" y="58" width="24" height="144" rx="12" fill="url(#iconAccent)" />
    <rect x="110" y="68" width="44" height="12" rx="6" fill="url(#iconCyan)" opacity="0.95" />
    <path
      d="M 110 120 C 110 112, 116 105, 124 101 L 168 76 C 178 70, 191 78, 191 89 C 191 95, 187 101, 182 104 L 142 126 C 135 130, 135 136, 142 140 L 183 162 C 188 165, 191 171, 191 177 C 191 188, 178 196, 168 190 L 124 165 C 116 161, 110 154, 110 146 Z"
      fill="url(#iconAccent)"
    />
    <circle cx="130" cy="133" r="9" fill="url(#iconCyan)" />
  </g>
</svg>`;

/**
 * Serves the default platform SVG icon directly with public caching headers.
 * Reads from disk if available, falling back to embedded SVG markup.
 *
 * @returns Promise resolving to a NextResponse containing the SVG image.
 */
async function serveDefaultIcon(): Promise<NextResponse> {
  const defaultPath = path.join(process.cwd(), "public", "icon.svg");
  try {
    if (existsSync(/*turbopackIgnore: true*/ defaultPath)) {
      const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ defaultPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }
  } catch {
    // Fallback to embedded SVG below
  }

  return new NextResponse(DEFAULT_SVG_FALLBACK, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

/**
 * Dynamic route handler serving the active tenant blog's configured custom favicon.
 * Directly serves local uploaded images or the default vector icon without redirecting to localhost:3000.
 *
 * @param request - NextRequest containing incoming headers and tenant domain context.
 * @returns Promise resolving to a binary image response or external redirect.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const site = (await getSiteForHost()) || (await getActiveSite());

  if (site?.faviconUrl) {
    const faviconUrl = site.faviconUrl.trim();

    // External absolute URLs (e.g. Cloudinary, custom CDN)
    if (faviconUrl.startsWith("http://") || faviconUrl.startsWith("https://")) {
      return NextResponse.redirect(faviconUrl, {
        status: 307,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    // Local uploads (/api/uploads/... or /uploads/...)
    if (faviconUrl.startsWith("/api/uploads/") || faviconUrl.startsWith("/uploads/")) {
      const relativePath = faviconUrl
        .replace(/^\/api\/uploads\//, "")
        .replace(/^\/uploads\//, "");

      const config = getStorageConfig(site.id);

      if (config.provider === "local") {
        const filePath = path.join(/*turbopackIgnore: true*/ config.uploadDir, relativePath);
        if (existsSync(/*turbopackIgnore: true*/ filePath)) {
          try {
            const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_MAP[ext] || "application/octet-stream";
            return new NextResponse(fileBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
              },
            });
          } catch {
            // Fallback to default
          }
        }
      } else if (config.publicUrl && !config.publicUrl.includes("r2.cloudflarestorage.com")) {
        return NextResponse.redirect(`${config.publicUrl}/${relativePath}`, {
          status: 307,
          headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      }
    }

    // Static icon reference
    if (faviconUrl === "/icon.svg" || faviconUrl.endsWith("/icon.svg")) {
      return serveDefaultIcon();
    }
  }

  return serveDefaultIcon();
}
