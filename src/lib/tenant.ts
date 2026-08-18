import { getDb } from "@/lib/db";
import { sites, users, type sites as sitesTable } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { headers } from "next/headers";

export type Site = typeof sitesTable.$inferSelect;

/**
 * Resolves the active site based on the current HTTP Host header or falls back to the default site.
 * Used across Server Components to ensure tenant data isolation.
 */
export async function getActiveSite(): Promise<Site | null> {
  const db = getDb();
  const headersList = await headers();
  const rawHost = headersList.get("host") || "localhost:3000";
  const cleanHost = rawHost.split(":")[0];

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
 * Checks whether any administrator account exists in the database.
 * If none exists, users must be routed to the initial setup wizard.
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
 * Checks whether at least one site is registered.
 */
export function hasAnySite(): boolean {
  const db = getDb();
  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(sites)
    .get();

  return (count?.count || 0) > 0;
}
