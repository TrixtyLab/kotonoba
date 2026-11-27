import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: () => null,
    redirect: () => undefined,
    usePathname: () => "/",
    useRouter: () => ({}),
    getPathname: () => "/",
  }),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import { proxy } from "@/proxy";
import { signAccessToken } from "@/lib/auth/jwt";
import { validate } from "@/lib/security/validate";
import { postSchema, pageSchema, siteSchema } from "@/lib/contracts";
import { getJwtSecretString, getEncryptionSecretString } from "@/lib/config/secrets";

describe("Proxy security headers, JWT verification, strict locale validation & secret fail-closed checks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects forged/missing JWT cookies on /admin, injects CSP/no-store on authenticated admin and /api routes, and enforces ADMIN_DOMAIN", async () => {
    vi.stubEnv("JWT_SECRET", "proxy-test-jwt-secret-min-32-chars!!");
    vi.stubEnv("CSP_MODE", "enforce");

    // 1. Unauthenticated /admin -> 307 redirect to /login with security headers + CSP
    const unauthReq = new NextRequest("https://blog.test/admin/posts");
    const unauthRes = await proxy(unauthReq);
    expect(unauthRes.status).toBe(307);
    expect(unauthRes.headers.get("location")).toContain("/login?redirect=%2Fadmin%2Fposts");
    expect(unauthRes.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(unauthRes.headers.get("x-frame-options")).toBe("DENY");

    // 2. Forged non-JWT cookie on /es/admin -> still rejected to /login
    const forgedReq = new NextRequest("https://blog.test/es/admin/users", {
      headers: { cookie: "access_token=fake.jwt.payload" },
    });
    const forgedRes = await proxy(forgedReq);
    expect(forgedRes.status).toBe(307);
    expect(forgedRes.headers.get("location")).toContain("/login");

    // 3. Valid HS256 JWT passes /admin with per-request nonce CSP and strict no-store headers
    const validJwt = await signAccessToken({
      userId: "u1",
      email: "admin@blog.test",
      role: "admin",
      siteId: "site-1",
      tokenVersion: 1,
    });
    const validReq = new NextRequest("https://blog.test/admin/posts", {
      headers: { cookie: `access_token=${validJwt}` },
    });
    const validRes = await proxy(validReq);
    expect(validRes.status).toBe(200);
    expect(validRes.headers.get("cache-control")).toContain("no-store");
    expect(validRes.headers.get("pragma")).toBe("no-cache");
    expect(validRes.headers.get("content-security-policy")).toContain("nonce-");

    // 4. API route (including paths with dots) gets security headers + no-store
    const apiRes = await proxy(new NextRequest("https://blog.test/api/media?v=1.0"));
    expect(apiRes.status).toBe(200);
    expect(apiRes.headers.get("cache-control")).toBe("no-store");
    expect(apiRes.headers.get("x-content-type-options")).toBe("nosniff");

    // 5. ADMIN_DOMAIN redirects /es/admin from blog hostname to admin hostname
    vi.stubEnv("ADMIN_DOMAIN", "admin.blog.test");
    const adminDomainRedirect = await proxy(
      new NextRequest("https://public.blog.test/es/admin?tab=general", {
        headers: { host: "public.blog.test", "x-forwarded-proto": "https" },
      })
    );
    expect(adminDomainRedirect.status).toBe(307);
    expect(adminDomainRedirect.headers.get("location")).toBe(
      "https://admin.blog.test/es/admin?tab=general"
    );
  });

  it("restricts post, page, and site validation strictly to en and es locales", () => {
    expect(validate(postSchema, { title: "Valid EN", locale: "en" }).success).toBe(true);
    expect(validate(postSchema, { title: "Válido ES", locale: "es" }).success).toBe(true);

    for (const unsupported of ["fr", "de", "pt", "it", "ja", "zh"]) {
      expect(validate(postSchema, { title: "Bad", locale: unsupported }).success).toBe(false);
      expect(validate(pageSchema, { title: "Bad", locale: unsupported }).success).toBe(false);
      expect(
        validate(siteSchema, { name: "Bad", domain: "bad.test", locale: unsupported }).success
      ).toBe(false);
    }
  });

  it("fails closed in production when JWT_SECRET or ENCRYPTION_KEY are missing, short, or reused", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("ENCRYPTION_KEY", "");

    expect(() => getJwtSecretString()).toThrow(/JWT_SECRET/);
    expect(() => getEncryptionSecretString()).toThrow(/ENCRYPTION_KEY/);

    vi.stubEnv("JWT_SECRET", "shared-production-secret-at-least-32-chars!!");
    vi.stubEnv("ENCRYPTION_KEY", "shared-production-secret-at-least-32-chars!!");
    expect(() => getEncryptionSecretString()).toThrow(/distinct from JWT_SECRET/);

    vi.stubEnv("ENCRYPTION_KEY", "separate-production-encryption-key-32chars!!");
    expect(getJwtSecretString()).toBe("shared-production-secret-at-least-32-chars!!");
    expect(getEncryptionSecretString()).toBe("separate-production-encryption-key-32chars!!");
  });
});
