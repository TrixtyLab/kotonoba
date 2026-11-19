import { getDb } from "@/lib/db";
import { sites, users, type sites as sitesTable } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultSiteUrl, isSingleTenantFallbackEnabled } from "@/lib/config/env";
import { getRequestHost } from "@/lib/http/request";

/**
 * Inferred database row type representing a registered blog site.
 */
export type Site = typeof sitesTable.$inferSelect;

/**
 * Normalizes a domain string by stripping protocol, port numbers, and trailing slashes.
 *
 * @param domain - Raw host or domain string.
 * @returns Cleaned, lowercase domain name string.
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0]
    .replace(/\/$/, "")
    .trim();
}

/**
 * Finds a registered blog site strictly matching the incoming HTTP Host header.
 * Returns null if the domain is not assigned to any blog site.
 *
 * @returns A Promise resolving to the matching Site entity, or null.
 */
export async function getSiteForHost(): Promise<Site | null> {
  const headersList = await headers();
  const rawHost = getRequestHost(headersList);
  const cleanHost = normalizeDomain(rawHost);

  try {
    const db = getDb();
    const allSites = db.select().from(sites).all();
    const matched = allSites.find((s) => {
      const siteClean = normalizeDomain(s.domain);
      return siteClean === cleanHost || s.domain.toLowerCase() === rawHost.toLowerCase();
    });

    return matched || null;
  } catch {
    return null;
  }
}

function isLocalHost(cleanHost: string): boolean {
  return (
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost === "::1" ||
    cleanHost.endsWith(".localhost")
  );
}

/**
 * Resolves the active tenant site for public blog/SEO routes.
 *
 * Strictly uses HTTP Host header domain matching in production so unmatched domains or
 * stale admin workspace cookies can never leak another tenant's public site.
 * On localhost/loopback dev hosts (or explicit single-site fallback), falls back safely.
 *
 * @returns Matched public `Site` record, or `null` if no host match applies.
 */
export async function getPublicSite(): Promise<Site | null> {
  const siteByHost = await getSiteForHost();
  if (siteByHost) return siteByHost;

  let cleanHost = "";
  try {
    const headersList = await headers();
    const rawHost = getRequestHost(headersList);
    cleanHost = normalizeDomain(rawHost);
  } catch {
    return null;
  }

  if (!isLocalHost(cleanHost) && !isSingleTenantFallbackEnabled()) {
    return null;
  }

  const db = getDb();
  if (isLocalHost(cleanHost)) {
    try {
      const cookieStore = await cookies();
      const adminSiteId = cookieStore.get("kotonoba_admin_site_id")?.value;
      if (adminSiteId) {
        const cookieSite = db.select().from(sites).where(eq(sites.id, adminSiteId)).get();
        if (cookieSite) return cookieSite;
      }
    } catch {
      // cookies() unavailable in static contexts
    }
  }

  return db.select().from(sites).limit(1).get() || null;
}

/**
 * Resolves the tenant site an authenticated administrator may manage.
 *
 * Unlike public host resolution, this never falls back to the first site for a
 * tenant-scoped user. A stale workspace cookie from a previous super-admin
 * session therefore cannot expose another tenant's dashboard data.
 *
 * @returns The site the current user is allowed to manage, or null.
 */
export async function getAdminSite(): Promise<Site | null> {
  const user = await getCurrentUser();
  if (!user?.exists) return null;

  const db = getDb();

  if (user.role === "super_admin") {
    try {
      const cookieStore = await cookies();
      const adminSiteId = cookieStore.get("kotonoba_admin_site_id")?.value;
      if (adminSiteId) {
        const siteByCookie = db.select().from(sites).where(eq(sites.id, adminSiteId)).get();
        if (siteByCookie) return siteByCookie;
      }
    } catch {
      // cookies() unavailable in static contexts
    }

    const siteByHost = await getSiteForHost();
    if (siteByHost) return siteByHost;

    return db.select().from(sites).limit(1).get() || null;
  }

  if (!user.siteId) return null;

  return db.select().from(sites).where(eq(sites.id, user.siteId)).get() || null;
}

/**
 * Verifies whether at least one administrator account is present in the database.
 * Used by layouts and middleware to conditionally route unconfigured deployments to the initial setup wizard.
 *
 * @returns True if at least one administrator exists, false otherwise.
 */
export function hasAdminUser(): boolean {
  const db = getDb();
  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(or(eq(users.role, "super_admin"), eq(users.role, "admin")))
    .get();

  return (count?.count || 0) > 0;
}

/**
 * Resolves the canonical base URL (protocol + host) for a given site context and incoming request.
 *
 * @param site - Optional Site entity.
 * @param reqHeaders - Optional incoming Headers collection.
 * @returns Fully qualified base URL string (e.g. "https://kagarisoft.unsetsoft.com" or "http://localhost:3000").
 */
export async function getCanonicalBaseUrl(site?: Site | null, reqHeaders?: Headers | null): Promise<string> {
  let domain = site?.domain;
  let hostHeader = "";

  if (reqHeaders) {
    hostHeader = getRequestHost(reqHeaders);
  } else {
    try {
      const h = await headers();
      hostHeader = getRequestHost(h);
    } catch {
      // static/prerender context
    }
  }

  if (!domain || domain.includes("localhost") || domain.includes("127.0.0.1")) {
    if (hostHeader && !hostHeader.includes("localhost") && !hostHeader.includes("127.0.0.1")) {
      domain = hostHeader;
    }
  }

  if (!domain) {
    domain = getDefaultSiteUrl().replace(/^https?:\/\//, "") || hostHeader || "localhost:3000";
  }

  const cleanDomain = normalizeDomain(domain);
  const isLocal =
    cleanDomain === "localhost" ||
    cleanDomain === "127.0.0.1" ||
    cleanDomain === "::1" ||
    cleanDomain.endsWith(".localhost") ||
    cleanDomain.startsWith("localhost:");

  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${cleanDomain}`;
}

