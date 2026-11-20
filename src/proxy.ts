import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { LOCALES, routing } from "@/i18n/routing";
import { verifyToken } from "@/lib/auth/jwt";
import { getAdminDomainEnv, getCspModeEnv, isDevelopmentEnv } from "@/lib/config/env";
import { getRequestHost } from "@/lib/http/request";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  getCspHeaderName,
} from "@/lib/security/headers";

const intlMiddleware = createMiddleware(routing);

const LOCALE_PREFIX_REGEX = new RegExp(`^\\/(?:${LOCALES.join("|")})(?=\\/|$)`);
const STATIC_ASSET_EXT_REGEX =
  /\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map|woff2?|ttf|eot|txt|xml|json)$/i;

function normalizeLocalePath(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX_REGEX, "");
  return stripped || "/";
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Root Next.js proxy handler enforcing per-request CSP nonces, security headers,
 * admin-domain routing, locale rewriting, and cryptographic JWT checks on admin paths.
 *
 * @param request - Incoming `NextRequest`.
 * @returns Outgoing `NextResponse` with applied security headers or redirects.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const normalizedPath = normalizeLocalePath(pathname);

  const isAdminRoute = normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");
  const isLoginRoute = normalizedPath === "/login" || normalizedPath.startsWith("/login/");
  const isSetupRoute = normalizedPath === "/setup" || normalizedPath.startsWith("/setup/");
  const isApiOrInternal = pathname.startsWith("/api/") || pathname === "/api" || pathname.startsWith("/_next");

  const isPublicStaticPath =
    !isAdminRoute &&
    !isLoginRoute &&
    !isSetupRoute &&
    (pathname === "/llms.txt" ||
      pathname === "/llms-full.txt" ||
      pathname === "/sitemap.xml" ||
      pathname === "/robots.txt" ||
      pathname === "/feed.xml" ||
      pathname === "/rss.xml" ||
      pathname === "/favicon.ico" ||
      STATIC_ASSET_EXT_REGEX.test(pathname));

  const nonce = btoa(crypto.randomUUID());
  const requestId = crypto.randomUUID();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() || "";
  const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";
  const cspValue = buildContentSecurityPolicy({
    nonce,
    isDev: isDevelopmentEnv(),
    isHttps,
  });
  const cspHeaderName = getCspHeaderName(getCspModeEnv());

  const withCommonHeaders = (response: NextResponse): NextResponse => {
    applySecurityHeaders(response.headers, { headerName: cspHeaderName, value: cspValue });
    response.headers.set("x-request-id", requestId);
    return response;
  };

  if (isApiOrInternal || isPublicStaticPath) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (
      pathname.startsWith("/api") &&
      !pathname.startsWith("/api/health") &&
      !pathname.startsWith("/api/favicon") &&
      !pathname.startsWith("/api/uploads")
    ) {
      response.headers.set("Cache-Control", "no-store");
    }
    return withCommonHeaders(response);
  }

  // If a dedicated ADMIN_DOMAIN is configured, redirect admin/auth routes from blog domains to ADMIN_DOMAIN.
  const rawAdminDomain = getAdminDomainEnv();
  if (rawAdminDomain) {
    const adminDomain = rawAdminDomain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(":")[0]
      .replace(/\/$/, "")
      .trim();
    const rawHost = getRequestHost(request.headers);
    const cleanHost = rawHost
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(":")[0]
      .replace(/\/$/, "")
      .trim();

    const isAdminOrAuthRoute = isAdminRoute || isLoginRoute || isSetupRoute;

    if (adminDomain && isAdminOrAuthRoute && cleanHost !== adminDomain && !isLocalHostname(cleanHost)) {
      const protocol = isHttps ? "https:" : "http:";
      const targetUrl = new URL(`${protocol}//${adminDomain}${pathname}${request.nextUrl.search}`);
      const redirectRes = NextResponse.redirect(targetUrl);
      return withCommonHeaders(redirectRes);
    }
  }

  if (isAdminRoute) {
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const accessPayload = accessToken ? await verifyToken(accessToken) : null;
    const refreshPayload = !accessPayload?.userId && refreshToken ? await verifyToken(refreshToken) : null;

    if (!accessPayload?.userId && !refreshPayload?.userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const loginRedirect = NextResponse.redirect(loginUrl);
      return withCommonHeaders(loginRedirect);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set(cspHeaderName, cspValue);

  const requestWithCsp = new NextRequest(request.url, {
    headers: requestHeaders,
    method: request.method,
  });

  const intlResponse = intlMiddleware(requestWithCsp);

  if (isAdminRoute) {
    intlResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    intlResponse.headers.set("Pragma", "no-cache");
    intlResponse.headers.set("Expires", "0");
  }

  return withCommonHeaders(intlResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
  ],
};
