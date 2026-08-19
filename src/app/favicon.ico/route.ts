import { NextResponse } from "next/server";
import { getSiteForHost, getActiveSite } from "@/lib/tenant";

/**
 * Default minimalist SVG favicon rendered when no custom favicon asset is configured.
 */
const DEFAULT_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2005/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#18181b"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="18" fill="#ffffff">K</text>
</svg>`;

/**
 * Dynamic route handler serving the site's configured favicon or redirecting to its uploaded asset URL.
 *
 * @returns NextResponse with redirect or SVG stream.
 */
export async function GET(): Promise<NextResponse> {
  const site = (await getSiteForHost()) || (await getActiveSite());

  if (site?.faviconUrl) {
    return NextResponse.redirect(new URL(site.faviconUrl, "http://localhost:3000"), {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  return new NextResponse(DEFAULT_FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
