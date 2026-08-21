"use server";

import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId } from "@/lib/utils/slug";
import { siteSchema, validate, type SiteInput } from "@/lib/security/validate";
import { normalizeMediaUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Result payload returned from site creation, update, or deletion operations.
 */
export type SiteMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Plain object representation of a persisted site record.
 */
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
 * Provisions a new tenant blog site record in the multi-tenant system.
 * Restricted to super_admin users.
 *
 * @param inputData - Partial site input containing name, domain, branding, and locale configuration.
 * @returns A Promise resolving to a SiteMutationResponse with the created site identifier or validation errors.
 * @throws {Error} When the caller is not authenticated as a super_admin.
 */
export async function createSite(inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  await requireAuth(["super_admin"]);
  const validation = validate(siteSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, domain, subtitle, description, locale, theme, primaryColor, fontFamily, supportedLocales } = validation.data;
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
      supportedLocales: supportedLocales || '["en"]',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");
  return { success: true, id };
}

/**
 * Updates an existing blog site's configuration, branding, navigation, and theme settings.
 * Merges partial inputs with existing database values before running schema validation.
 *
 * @param siteId - Unique database identifier of the site to update.
 * @param inputData - Partial dictionary of modified site attributes.
 * @returns A Promise resolving to a SiteMutationResponse with success status or validation errors.
 * @throws {Error} When the caller is not authenticated as an admin or super_admin.
 */
export async function updateSite(siteId: string, inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  const currentUser = await requireAuth(["super_admin", "admin"]);
  if (currentUser.role === "admin" && currentUser.siteId && currentUser.siteId !== siteId) {
    return { success: false, error: "You can only edit settings for your assigned site." };
  }

  const db = getDb();
  const existing = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!existing) {
    return { success: false, errors: { site: ["Site not found"] } };
  }

  const merged = {
    name: inputData.name !== undefined ? inputData.name : existing.name,
    domain: inputData.domain !== undefined ? inputData.domain : existing.domain,
    subtitle: inputData.subtitle !== undefined ? inputData.subtitle : existing.subtitle,
    description: inputData.description !== undefined ? inputData.description : existing.description,
    logoUrl: inputData.logoUrl !== undefined ? inputData.logoUrl : existing.logoUrl,
    faviconUrl: inputData.faviconUrl !== undefined ? inputData.faviconUrl : existing.faviconUrl,
    locale: inputData.locale !== undefined ? inputData.locale : existing.locale,
    theme: inputData.theme !== undefined ? inputData.theme : (existing.theme as "dark" | "light"),
    primaryColor: inputData.primaryColor !== undefined ? inputData.primaryColor : existing.primaryColor,
    fontFamily: inputData.fontFamily !== undefined ? inputData.fontFamily : existing.fontFamily,
    navLinks: inputData.navLinks !== undefined ? inputData.navLinks : (existing.navLinks || "[]"),
    navAlignment: inputData.navAlignment !== undefined ? inputData.navAlignment : (existing.navAlignment as any || "left"),
    supportedLocales: inputData.supportedLocales !== undefined ? inputData.supportedLocales : (existing.supportedLocales || '["en"]'),
  };

  const validation = validate(siteSchema, merged);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, domain, subtitle, description, logoUrl, faviconUrl, locale, theme, primaryColor, fontFamily, navLinks, navAlignment, supportedLocales } = validation.data;
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const now = new Date();

  db.update(sites)
    .set({
      name,
      domain: cleanDomain,
      subtitle: subtitle || "",
      description: description || "",
      logoUrl: logoUrl !== undefined ? normalizeMediaUrl(logoUrl) || null : null,
      faviconUrl: faviconUrl !== undefined ? normalizeMediaUrl(faviconUrl) || null : null,
      locale: locale || "en",
      theme: theme || "dark",
      primaryColor: primaryColor || "#6366f1",
      fontFamily: fontFamily || "Inter",
      navLinks: navLinks !== undefined ? navLinks : "[]",
      navAlignment: navAlignment || "left",
      supportedLocales: supportedLocales !== undefined ? supportedLocales : '["en"]',
      updatedAt: now,
    })
    .where(eq(sites.id, siteId))
    .run();

  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");
  return { success: true };
}

/**
 * Permanently removes a tenant site and cascades deletion to all associated posts, categories, and settings.
 * Prevents deletion if the target is the sole remaining site in the deployment.
 *
 * @param siteId - Unique database identifier of the site to delete.
 * @returns A Promise resolving to a SiteMutationResponse.
 * @throws {Error} When the caller is not authenticated as a super_admin.
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
 * Sets the active workspace site cookie for the administrator panel navigation.
 *
 * @param siteId - Unique database identifier of the selected site.
 * @returns A Promise resolving to an object indicating success.
 * @throws {Error} When the caller lacks an authorized administrative session.
 */
export async function setActiveSiteAction(siteId: string): Promise<{ success: boolean }> {
  const currentUser = await requireAuth(["super_admin", "admin", "editor", "author"]);
  
  // If user is not super_admin and is assigned to a specific site, verify authorization
  const isGlobalUser = currentUser.role === "super_admin" || !currentUser.siteId;
  if (!isGlobalUser && currentUser.siteId !== siteId) {
    return { success: false };
  }

  const db = getDb();
  const exists = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!exists) {
    return { success: false };
  }

  const cookieStore = await cookies();
  cookieStore.set("kotonoba_admin_site_id", siteId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all registered tenant sites sorted in reverse chronological creation order.
 *
 * @returns A Promise resolving to an array of SiteRecord objects.
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
