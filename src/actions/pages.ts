"use server";

import { ROLE_ALL, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireResourceAccess, requireSiteAccess } from "@/lib/auth/site-access";
import { revalidatePagePaths } from "@/lib/cache/revalidate";
import { pageSchema, validate, type PageInput } from "@/lib/security/validate";
import {
  createPageService,
  deletePageService,
  getPageRowById,
  listAdminPages,
  listPublishedPages,
  updatePageService,
  type AdminPageRecord,
  type PageMutationResponse,
} from "@/lib/services/pages";

export type { AdminPageRecord, PageMutationResponse };

/** Creates a custom static page within an authorized tenant site. */
export async function createPage(siteId: string, inputData: Partial<PageInput>): Promise<PageMutationResponse> {
  const actor = await requireSiteAccess(siteId, ROLE_ALL);
  const validation = validate(pageSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { result, pageSlug } = createPageService(actor, siteId, validation.data);
  if (result.success) {
    revalidatePagePaths(pageSlug);
  }
  return result;
}

/** Updates an existing custom page within its owning tenant. */
export async function updatePage(pageId: string, inputData: Partial<PageInput>): Promise<PageMutationResponse> {
  const validation = validate(pageSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const existing = getPageRowById(pageId);
  if (!existing) {
    return { success: false, error: "Page not found" };
  }

  const actor = await requireSiteAccess(existing.siteId, ROLE_ALL);
  const { result, pageSlug } = updatePageService(actor, existing, validation.data);
  if (result.success) {
    revalidatePagePaths(pageSlug, existing.slug);
  }
  return result;
}

/** Deletes a custom static page and cascades analytics removal. */
export async function deletePage(pageId: string): Promise<{ success: boolean; error?: string }> {
  const { user } = await requireResourceAccess("page", pageId, ROLE_PUBLISHERS);
  const res = deletePageService(user, pageId);
  if (!res.success) {
    return { success: false, error: res.error };
  }
  revalidatePagePaths(res.slug);
  return { success: true };
}

/** Lists all custom pages belonging to an admin site workspace. */
export async function getPages(siteId: string): Promise<AdminPageRecord[]> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listAdminPages(siteId);
}

/** Lists published static pages for admin navigation selectors. */
export async function getPublishedPages(
  siteId: string
): Promise<Array<{ id: string; title: string; slug: string; locale: string }>> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listPublishedPages(siteId);
}
