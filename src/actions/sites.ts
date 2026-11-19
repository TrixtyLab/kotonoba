"use server";

import { cookies } from "next/headers";
import { ROLE_ADMINS, ROLE_ALL, ROLE_SUPER_ADMIN } from "@/lib/auth/roles";
import { requireAuth } from "@/lib/auth/session";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateSiteShell } from "@/lib/cache/revalidate";
import { isProductionEnv } from "@/lib/config/env";
import { siteSchema, validate, type SiteInput } from "@/lib/security/validate";
import {
  createSiteService,
  deleteSiteService,
  listSitesForActor,
  siteExistsById,
  updateSiteService,
  type SiteMutationResponse,
  type SiteRecord,
} from "@/lib/services/sites";

export type { SiteMutationResponse, SiteRecord };

/** Creates a new tenant blog site (super_admin only). */
export async function createSite(inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  const actor = await requireAuth(ROLE_SUPER_ADMIN);
  const validation = validate(siteSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const res = createSiteService(actor, validation.data);
  if (res.success) revalidateSiteShell();
  return res;
}

/** Updates an existing site's branding, domain, navigation, and CSS settings. */
export async function updateSite(siteId: string, inputData: Partial<SiteInput>): Promise<SiteMutationResponse> {
  const actor = await requireSiteAccess(siteId, ROLE_ADMINS);
  const res = updateSiteService(actor, siteId, inputData);
  if (res.success) revalidateSiteShell();
  return res;
}

/** Permanently deletes a tenant site (super_admin only; guards last remaining site). */
export async function deleteSite(siteId: string): Promise<SiteMutationResponse> {
  const actor = await requireAuth(ROLE_SUPER_ADMIN);
  const res = deleteSiteService(actor, siteId);
  if (res.success) revalidateSiteShell();
  return res;
}

/** Sets the active workspace site cookie for admin navigation after validating access. */
export async function setActiveSiteAction(siteId: string): Promise<{ success: boolean }> {
  await requireSiteAccess(siteId, ROLE_ALL);
  if (!siteExistsById(siteId)) {
    return { success: false };
  }

  const cookieStore = await cookies();
  cookieStore.set("kotonoba_admin_site_id", siteId, {
    path: "/",
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidateSiteShell();
  return { success: true };
}

/** Lists sites accessible to the authenticated actor (`super_admin` sees all; others see assigned site). */
export async function getAllSites(): Promise<SiteRecord[]> {
  const actor = await requireAuth(ROLE_ALL);
  return listSitesForActor(actor);
}
