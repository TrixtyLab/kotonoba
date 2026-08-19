import { getDb } from "@/lib/db";
import { sites, users, type sites as sitesTable } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { headers, cookies } from "next/headers";

/**
 * Inferred database row type representing a registered blog site.
 */
export type Site = typeof sitesTable.$inferSelect;

/**
 * Resolves the active tenant site for the current request.
 * Prioritizes incoming HTTP Host header domain matches, followed by the active admin workspace cookie, and finally defaults to the primary registered site.
 *
 * @returns A Promise resolving to the matched Site entity, or null if no sites exist in the database.
 */
export async function getActiveSite(): Promise<Site | null> {
  const db = getDb();
  const headersList = await headers();
  const rawHost = headersList.get("host") || "localhost:3000";
  const cleanHost = rawHost.split(":")[0];

  const isLocal = cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "::1" || cleanHost.endsWith(".localhost");
  if (!isLocal) {
    const domainMatched = db
      .select()
      .from(sites)
      .where(or(eq(sites.domain, cleanHost), eq(sites.domain, rawHost)))
      .get();

    if (domainMatched) return domainMatched;
  }

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

  const matched = db
    .select()
    .from(sites)
    .where(or(eq(sites.domain, cleanHost), eq(sites.domain, rawHost)))
    .get();

  if (matched) return matched;

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
