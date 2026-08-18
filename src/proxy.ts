import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { applySecurityHeaders } from "@/lib/security/headers";

const intlMiddleware = createMiddleware(routing);

/**
 * Next.js 16 proxy replacing legacy middleware.
 * Orchestrates multi-language route resolution, defense-in-depth security headers, and admin session routing.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    const response = NextResponse.next();
    applySecurityHeaders(response.headers);
    if (pathname.startsWith("/api") && !pathname.startsWith("/api/health")) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  }

  const intlResponse = intlMiddleware(request);

  if (pathname.includes("/admin")) {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  applySecurityHeaders(intlResponse.headers);
  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
  ],
};
