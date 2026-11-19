import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { generateId } from "@/lib/utils/slug";
import { siteSchema, validate, type SiteInput } from "@/lib/security/validate";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { sanitizeCss, sanitizeNavLinksJson, sanitizeUrl } from "@/lib/security/sanitize";
import { recordAuditEvent } from "@/lib/security/audit";

/** Result payload returned from site creation, update, or deletion operations. */
export type SiteMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/** Plain object representation of a persisted site record. */
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

export function createSiteService(actor: TokenPayload, data: SiteInput): SiteMutationResponse {
  const { name, domain, subtitle, description, locale, theme, primaryColor, fontFamily, supportedLocales } = data;
  const db = getDb();
  const id = generateId();
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  const existingDomain = db.select({ id: sites.id }).from(sites).where(eq(sites.domain, cleanDomain)).get();
  if (existingDomain) {
    return { success: false, errors: { domain: ["Domain is already registered to another site."] } };
  }

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

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: id,
    action: "site.create",
    targetType: "site",
    targetId: id,
    metadata: { domain: cleanDomain },
  });

  return { success: true, id };
}

export function updateSiteService(
  actor: TokenPayload,
  siteId: string,
  inputData: Partial<SiteInput>
): SiteMutationResponse {
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
    customCss: inputData.customCss !== undefined ? inputData.customCss : existing.customCss || "",
    primaryColor: inputData.primaryColor !== undefined ? inputData.primaryColor : existing.primaryColor,
    fontFamily: inputData.fontFamily !== undefined ? inputData.fontFamily : existing.fontFamily,
    navLinks: inputData.navLinks !== undefined ? inputData.navLinks : existing.navLinks || "[]",
    navAlignment:
      inputData.navAlignment !== undefined
        ? inputData.navAlignment
        : ((existing.navAlignment as "left" | "center" | "right" | null) || "left"),
    supportedLocales:
      inputData.supportedLocales !== undefined ? inputData.supportedLocales : existing.supportedLocales || '["en"]',
  };

  const validation = validate(siteSchema, merged);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const {
    name,
    domain,
    subtitle,
    description,
    logoUrl,
    faviconUrl,
    locale,
    theme,
    customCss,
    primaryColor,
    fontFamily,
    navLinks,
    navAlignment,
    supportedLocales,
  } = validation.data;
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  if (cleanDomain !== existing.domain) {
    const conflictingDomain = db.select({ id: sites.id }).from(sites).where(eq(sites.domain, cleanDomain)).get();
    if (conflictingDomain && conflictingDomain.id !== siteId) {
      return { success: false, errors: { domain: ["Domain is already registered to another site."] } };
    }
  }

  const safeLogoUrl = logoUrl ? sanitizeUrl(normalizeMediaUrl(logoUrl), { allowRelative: true }) : null;
  const safeFaviconUrl = faviconUrl ? sanitizeUrl(normalizeMediaUrl(faviconUrl), { allowRelative: true }) : null;
  const safeNavLinks = sanitizeNavLinksJson(navLinks);
  const safeCustomCss = sanitizeCss(customCss);

  db.update(sites)
    .set({
      name,
      domain: cleanDomain,
      subtitle: subtitle || "",
      description: description || "",
      logoUrl: safeLogoUrl,
      faviconUrl: safeFaviconUrl,
      locale: locale || "en",
      theme: theme || "dark",
      customCss: safeCustomCss,
      primaryColor: primaryColor || "#6366f1",
      fontFamily: fontFamily || "Inter",
      navLinks: safeNavLinks,
      navAlignment: navAlignment || "left",
      supportedLocales: supportedLocales !== undefined ? supportedLocales : '["en"]',
      updatedAt: new Date(),
    })
    .where(eq(sites.id, siteId))
    .run();

  if (cleanDomain !== existing.domain) {
    recordAuditEvent({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      siteId,
      action: "site.domain_change",
      targetType: "site",
      targetId: siteId,
      metadata: { previousDomain: existing.domain, nextDomain: cleanDomain },
    });
  }

  return { success: true };
}

export function deleteSiteService(actor: TokenPayload, siteId: string): SiteMutationResponse {
  const db = getDb();
  const allSites = db.select().from(sites).all();
  if (allSites.length <= 1) {
    return { success: false, error: "Cannot delete the only remaining site." };
  }

  const target = allSites.find((s) => s.id === siteId);
  db.delete(sites).where(eq(sites.id, siteId)).run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId,
    action: "site.delete",
    targetType: "site",
    targetId: siteId,
    metadata: { domain: target?.domain || null },
  });

  return { success: true };
}

export function siteExistsById(siteId: string): boolean {
  return Boolean(getDb().select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get());
}

export function getSiteById(siteId: string) {
  return getDb().select().from(sites).where(eq(sites.id, siteId)).get() || null;
}

export function listSitesForActor(actor: TokenPayload): SiteRecord[] {
  const db = getDb();
  const query = db
    .select({
      id: sites.id,
      name: sites.name,
      domain: sites.domain,
      subtitle: sites.subtitle,
      description: sites.description,
      logoUrl: sites.logoUrl,
      faviconUrl: sites.faviconUrl,
      locale: sites.locale,
      theme: sites.theme,
      primaryColor: sites.primaryColor,
      fontFamily: sites.fontFamily,
      createdAt: sites.createdAt,
      updatedAt: sites.updatedAt,
    })
    .from(sites);

  if (actor.role === "super_admin") {
    return query.orderBy(desc(sites.createdAt)).all() as SiteRecord[];
  }
  if (!actor.siteId) {
    return [];
  }
  return query.where(eq(sites.id, actor.siteId)).orderBy(desc(sites.createdAt)).all() as SiteRecord[];
}
