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
    if (
      pathname.startsWith("/api") &&
      !pathname.startsWith("/api/health") &&
      !pathname.startsWith("/api/favicon") &&
      !pathname.startsWith("/api/uploads")
    ) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  }

  // If a dedicated ADMIN_DOMAIN is configured, redirect admin/auth routes from blog domains to ADMIN_DOMAIN
  const rawAdminDomain = process.env.ADMIN_DOMAIN;
  if (rawAdminDomain) {
    const adminDomain = rawAdminDomain.toLowerCase().replace(/^https?:\/\//, "").split(":")[0].replace(/\/$/, "").trim();
    const rawHost =
      request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      request.headers.get("host")?.split(",")[0].trim() ||
      "";
    const cleanHost = rawHost.toLowerCase().replace(/^https?:\/\//, "").split(":")[0].replace(/\/$/, "").trim();
    const isLocal =
      cleanHost === "localhost" ||
      cleanHost === "127.0.0.1" ||
      cleanHost === "::1" ||
      cleanHost.endsWith(".localhost");

    const isAdminOrAuthRoute =
      pathname.includes("/admin") ||
      pathname.includes("/login") ||
      pathname.includes("/setup");

    if (isAdminOrAuthRoute && cleanHost !== adminDomain && !isLocal) {
      const forwardedProto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol || "https:";
      const protocol = forwardedProto.split(",")[0].trim().includes("http") ? (forwardedProto.includes("https") ? "https:" : "http:") : "https:";
      const targetUrl = new URL(`${protocol}//${adminDomain}${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(targetUrl);
    }
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
