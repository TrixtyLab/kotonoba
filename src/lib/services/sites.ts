import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { generateId } from "@/lib/utils/slug";
import { validate } from "@/lib/security/validate";
import { siteSchema, type SiteInput } from "@/lib/contracts";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { sanitizeCss, sanitizeNavLinksJson, sanitizeUrl } from "@/lib/security/sanitize";
import { recordAuditEvent } from "@/lib/security/audit";
import { ROLES } from "@/lib/config/constants";
import { resolveBrandFont } from "@/lib/config/brand";

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
      fontFamily: resolveBrandFont(fontFamily).id,
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

function mergeSiteTextPayload(existing: typeof sites.$inferSelect, input: Partial<SiteInput>) {
  return {
    name: input.name ?? existing.name,
    domain: input.domain ?? existing.domain,
    subtitle: input.subtitle ?? existing.subtitle,
    description: input.description ?? existing.description,
    logoUrl: input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
    faviconUrl: input.faviconUrl !== undefined ? input.faviconUrl : existing.faviconUrl,
    locale: input.locale ?? existing.locale,
  };
}

function mergeSitePresentationPayload(existing: typeof sites.$inferSelect, input: Partial<SiteInput>) {
  const existingNavAlign = (existing.navAlignment as "left" | "center" | "right" | null) || "left";
  return {
    theme: input.theme ?? (existing.theme as "dark" | "light"),
    customCss: input.customCss ?? existing.customCss ?? "",
    primaryColor: input.primaryColor ?? existing.primaryColor,
    fontFamily: input.fontFamily ?? existing.fontFamily,
    navLinks: input.navLinks ?? existing.navLinks ?? "[]",
    navAlignment: input.navAlignment ?? existingNavAlign,
    supportedLocales: input.supportedLocales ?? existing.supportedLocales ?? '["en"]',
  };
}

function mergeSiteUpdatePayload(existing: typeof sites.$inferSelect, input: Partial<SiteInput>) {
  return {
    ...mergeSiteTextPayload(existing, input),
    ...mergeSitePresentationPayload(existing, input),
  };
}

function buildSanitizedSiteColumnPatch(data: SiteInput, cleanDomain: string) {
  return {
    name: data.name,
    domain: cleanDomain,
    subtitle: data.subtitle || "",
    description: data.description || "",
    logoUrl: data.logoUrl ? sanitizeUrl(normalizeMediaUrl(data.logoUrl), { allowRelative: true }) : null,
    faviconUrl: data.faviconUrl ? sanitizeUrl(normalizeMediaUrl(data.faviconUrl), { allowRelative: true }) : null,
    locale: data.locale || "en",
    theme: data.theme || "dark",
    customCss: sanitizeCss(data.customCss),
    primaryColor: data.primaryColor || "#6366f1",
    fontFamily: resolveBrandFont(data.fontFamily).id,
    navLinks: sanitizeNavLinksJson(data.navLinks),
    navAlignment: data.navAlignment || "left",
    supportedLocales: data.supportedLocales !== undefined ? data.supportedLocales : '["en"]',
    updatedAt: new Date(),
  };
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

  const validation = validate(siteSchema, mergeSiteUpdatePayload(existing, inputData));
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const cleanDomain = validation.data.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  if (cleanDomain !== existing.domain) {
    const conflictingDomain = db.select({ id: sites.id }).from(sites).where(eq(sites.domain, cleanDomain)).get();
    if (conflictingDomain && conflictingDomain.id !== siteId) {
      return { success: false, errors: { domain: ["Domain is already registered to another site."] } };
    }
  }

  db.update(sites).set(buildSanitizedSiteColumnPatch(validation.data, cleanDomain)).where(eq(sites.id, siteId)).run();

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

  if (actor.role === ROLES.SUPER_ADMIN) {
    return query.orderBy(desc(sites.createdAt)).all() as SiteRecord[];
  }
  if (!actor.siteId) {
    return [];
  }
  return query.where(eq(sites.id, actor.siteId)).orderBy(desc(sites.createdAt)).all() as SiteRecord[];
}
