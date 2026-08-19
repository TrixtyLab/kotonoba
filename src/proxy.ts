import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { applySecurityHeaders } from "@/lib/security/headers";

const intlMiddleware = createMiddleware(routing);

/**
 * Root Edge middleware handler executing security header enforcement, internationalization routing, and protected dashboard redirection.
 *
 * @param request - The incoming NextRequest object.
 * @returns An outgoing NextResponse with applied security headers or internationalization redirects.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/feed.xml" ||
    pathname === "/rss.xml" ||
    pathname === "/favicon.ico"
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
    const token = request.cookies.get("access_token")?.value || request.cookies.get("refresh_token")?.value;
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
