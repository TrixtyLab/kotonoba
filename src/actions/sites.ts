"use server";

import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId } from "@/lib/utils/slug";
import { siteSchema, validate, type SiteInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

export type SiteMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

export interface SiteRecord {
  id: string;
  name: string;
  domain: string;
  subtitle: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  locale: string;
  theme: "dark" | "light";
  primaryColor: string | null;
  fontFamily: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new blog/site instance in the multi-tenant system.
 * Restricted to super_admin.
 */
export async function createSite(inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  await requireAuth(["super_admin"]);
  const validation = validate(siteSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, domain, subtitle, description, locale, theme, primaryColor, fontFamily } = validation.data;
  const db = getDb();
  const id = generateId();
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const now = new Date();

  db.insert(sites)
    .values({
      id,
      name,
      domain: cleanDomain,
      subtitle: subtitle || "",
      description: description || "",
      locale: locale || "en",
      theme: theme || "dark",
      primaryColor: primaryColor || "#6366f1",
      fontFamily: fontFamily || "Inter",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  revalidatePath("/", "layout");
  return { success: true, id };
}

/**
 * Updates an existing blog configuration.
 */
export async function updateSite(siteId: string, inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  await requireAuth(["super_admin", "admin"]);
  const validation = validate(siteSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, domain, subtitle, description, locale, theme, primaryColor, fontFamily } = validation.data;
  const db = getDb();
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const now = new Date();

  db.update(sites)
    .set({
      name,
      domain: cleanDomain,
      subtitle: subtitle || "",
      description: description || "",
      locale: locale || "en",
      theme: theme || "dark",
      primaryColor: primaryColor || "#6366f1",
      fontFamily: fontFamily || "Inter",
      updatedAt: now,
    })
    .where(eq(sites.id, siteId))
    .run();

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Deletes a site and all associated data.
 */
export async function deleteSite(siteId: string): Promise<SiteMutationResponse> {
  await requireAuth(["super_admin"]);
  const db = getDb();

  const allSites = db.select().from(sites).all();
  if (allSites.length <= 1) {
    return { success: false, error: "Cannot delete the only remaining site." };
  }

  db.delete(sites).where(eq(sites.id, siteId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all registered sites for multi-tenant switching.
 */
export async function getAllSites(): Promise<SiteRecord[]> {
  const db = getDb();
  const rows = db
    .select()
    .from(sites)
    .orderBy(desc(sites.createdAt))
    .all();

  return rows.map((r) => ({
    ...r,
    theme: (r.theme as "dark" | "light") || "dark",
  }));
}
