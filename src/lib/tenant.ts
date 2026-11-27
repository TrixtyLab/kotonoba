import { getDb } from "@/lib/db";
import { sites, users, type sites as sitesTable } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLES } from "@/lib/config/constants";
import { getDefaultSiteUrl, isSingleTenantFallbackEnabled } from "@/lib/config/env";
import { getRequestHost } from "@/lib/http/request";
import { runWithTenantCache, tenantRegistryCacheTag } from "@/lib/cache/revalidate";

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

function rehydrateSiteDates(site: Site | null): Site | null {
  if (!site) return null;
  return {
    ...site,
    createdAt: site.createdAt instanceof Date ? site.createdAt : new Date(site.createdAt),
    updatedAt: site.updatedAt instanceof Date ? site.updatedAt : new Date(site.updatedAt),
  };
}

function resolveSiteByHostSync(cleanHost: string, rawHost: string): Site | null {
  const db = getDb();
  const allSites = db.select().from(sites).all();
  const matched = allSites.find((s) => {
    const siteClean = normalizeDomain(s.domain);
    return siteClean === cleanHost || s.domain.toLowerCase() === rawHost.toLowerCase();
  });
  return matched || null;
}

/**
 * Returns the normalized incoming HTTP `Host` header (or `"default"` outside HTTP requests).
 */
export async function getRequestNormalizedHost(): Promise<string> {
  try {
    const headersList = await headers();
    const rawHost = getRequestHost(headersList);
    return normalizeDomain(rawHost) || "default";
  } catch {
    return "default";
  }
}

/**
 * Finds a registered blog site strictly matching the incoming HTTP Host header behind tenant cache.
 * Returns null if the domain is not assigned to any blog site.
 *
 * @returns A Promise resolving to the matching Site entity, or null.
 */
export async function getSiteForHost(): Promise<Site | null> {
  let rawHost = "";
  try {
    const headersList = await headers();
    rawHost = getRequestHost(headersList);
  } catch {
    return null;
  }
  const cleanHost = normalizeDomain(rawHost);
  if (!cleanHost) return null;

  try {
    const cached = await runWithTenantCache(
      async () => resolveSiteByHostSync(cleanHost, rawHost),
      ["tenant-site-host", cleanHost],
      {
        tags: [tenantRegistryCacheTag()],
        revalidate: 60,
      }
    );
    return rehydrateSiteDates(cached);
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
 * Strictly uses cached HTTP Host domain matching in production so unmatched domains or
 * stale admin workspace cookies can never leak another tenant's public site.
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
 * @returns The site the current user is allowed to manage, or null.
 */
export async function getAdminSite(): Promise<Site | null> {
  const user = await getCurrentUser();
  if (!user?.exists) return null;

  const db = getDb();

  if (user.role === ROLES.SUPER_ADMIN) {
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
 *
 * @returns True if at least one administrator exists, false otherwise.
 */
export function hasAdminUser(): boolean {
  const db = getDb();
  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(or(eq(users.role, ROLES.SUPER_ADMIN), eq(users.role, ROLES.ADMIN)))
    .get();

  return (count?.count || 0) > 0;
}

async function readRequestHostHeader(reqHeaders?: Headers | null): Promise<string> {
  if (reqHeaders) return getRequestHost(reqHeaders);
  try {
    return getRequestHost(await headers());
  } catch {
    return "";
  }
}

function isLocalhostDomain(cleanDomain: string): boolean {
  return (
    cleanDomain === "localhost" ||
    cleanDomain === "127.0.0.1" ||
    cleanDomain === "::1" ||
    cleanDomain.endsWith(".localhost") ||
    cleanDomain.startsWith("localhost:")
  );
}

/**
 * Resolves the canonical base URL (protocol + host) for a given site context and incoming request.
 *
 * @param site - Optional Site entity.
 * @param reqHeaders - Optional incoming Headers collection.
 * @returns Fully qualified base URL string.
 */
export async function getCanonicalBaseUrl(site?: Site | null, reqHeaders?: Headers | null): Promise<string> {
  const hostHeader = await readRequestHostHeader(reqHeaders);
  const siteDomain = site?.domain;
  const preferHeader =
    (!siteDomain || isLocalhostDomain(normalizeDomain(siteDomain))) &&
    Boolean(hostHeader && !isLocalhostDomain(normalizeDomain(hostHeader)));

  const fallbackDomain = getDefaultSiteUrl().replace(/^https?:\/\//, "") || hostHeader || "localhost:3000";
  const resolved = preferHeader ? hostHeader : siteDomain || fallbackDomain;
  const cleanDomain = normalizeDomain(resolved);
  const protocol = isLocalhostDomain(cleanDomain) ? "http" : "https";
  return `${protocol}://${cleanDomain}`;
}
