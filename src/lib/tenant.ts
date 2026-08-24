import { getDb } from "@/lib/db";
import { sites, users, type sites as sitesTable } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { headers, cookies } from "next/headers";

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
  try {
    const db = getDb();
    const headersList = await headers();
    const rawHost =
      headersList.get("x-forwarded-host")?.split(",")[0].trim() ||
      headersList.get("host")?.split(",")[0].trim() ||
      "localhost:3000";
    const cleanHost = normalizeDomain(rawHost);

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

/**
 * Resolves the active tenant site for the current request context.
 * Prioritizes incoming HTTP Host header domain matches, followed by the active admin workspace cookie, and finally defaults to the primary registered site for admin context.
 *
 * @returns A Promise resolving to the matched Site entity, or null if no sites exist in the database.
 */
export async function getActiveSite(): Promise<Site | null> {
  const db = getDb();


  const siteByHost = await getSiteForHost();
  if (siteByHost) return siteByHost;

  try {
    const cookieStore = await cookies();
    const adminSiteId = cookieStore.get("kotonoba_admin_site_id")?.value;
    if (adminSiteId) {
      const siteById = db.select().from(sites).where(eq(sites.id, adminSiteId)).get();
      if (siteById) return siteById;
    }
  } catch {
    // cookies() unavailable in static prerendering contexts
  }

  const defaultSite = db.select().from(sites).limit(1).get();
  return defaultSite || null;
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
 * Checks whether any blog site records have been created in the database.
 *
 * @returns True if at least one site is registered, false otherwise.
 */
export function hasAnySite(): boolean {
  const db = getDb();
  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(sites)
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
    hostHeader =
      reqHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
      reqHeaders.get("host")?.split(",")[0].trim() ||
      "";
  } else {
    try {
      const h = await headers();
      hostHeader =
        h.get("x-forwarded-host")?.split(",")[0].trim() ||
        h.get("host")?.split(",")[0].trim() ||
        "";
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
    domain = process.env.SITE_URL?.replace(/^https?:\/\//, "") || hostHeader || "localhost:3000";
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

