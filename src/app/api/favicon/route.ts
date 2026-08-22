import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSiteForHost, getActiveSite } from "@/lib/tenant";

/**
 * Dynamic route handler serving the active tenant blog's configured custom favicon.
 * If the active site has a custom favicon uploaded, it redirects to that custom asset.
 * If not configured, it redirects/serves the default platform vector icon (/icon.svg).
 *
 * @param request - NextRequest containing hostname and headers.
 * @returns NextResponse with redirect or SVG stream.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const site = (await getSiteForHost()) || (await getActiveSite());

  if (site?.faviconUrl) {
    const isAbsolute = site.faviconUrl.startsWith("http://") || site.faviconUrl.startsWith("https://");
    const targetUrl = isAbsolute
      ? site.faviconUrl
      : new URL(site.faviconUrl, request.url).toString();

    return NextResponse.redirect(targetUrl, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  const defaultUrl = new URL("/icon.svg", request.url);
  return NextResponse.redirect(defaultUrl, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
