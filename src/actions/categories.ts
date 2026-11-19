"use server";

import { ROLE_ADMINS, ROLE_ALL, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateSiteShell } from "@/lib/cache/revalidate";
import { categorySchema, validate, type CategoryInput } from "@/lib/security/validate";
import {
  createCategoryService,
  deleteCategoryService,
  getCategorySiteId,
  listCategoriesForSite,
  updateCategoryService,
  type CategoryMutationResponse,
  type CategoryRecord,
} from "@/lib/services/taxonomy";

export type { CategoryMutationResponse, CategoryRecord };

/** Creates a category classification under a tenant site. */
export async function createCategory(
  siteId: string,
  inputData: Partial<CategoryInput>
): Promise<CategoryMutationResponse> {
  await requireSiteAccess(siteId, ROLE_PUBLISHERS);
  const validation = validate(categorySchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const res = createCategoryService(siteId, validation.data);
  if (res.success) revalidateSiteShell();
  return res;
}

/** Updates a category's properties within its owning tenant. */
export async function updateCategory(
  categoryId: string,
  inputData: Partial<CategoryInput>
): Promise<CategoryMutationResponse> {
  const siteId = getCategorySiteId(categoryId);
  if (!siteId) return { success: false, error: "Category not found" };

  await requireSiteAccess(siteId, ROLE_PUBLISHERS);
  const validation = validate(categorySchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const res = updateCategoryService(categoryId, siteId, validation.data);
  if (res.success) revalidateSiteShell();
  return res;
}

/** Removes a category by ID after verifying site admin access. */
export async function deleteCategory(categoryId: string): Promise<{ success: boolean; error?: string }> {
  const siteId = getCategorySiteId(categoryId);
  if (!siteId) return { success: false, error: "Category not found" };

  await requireSiteAccess(siteId, ROLE_ADMINS);
  deleteCategoryService(categoryId);
  revalidateSiteShell();
  return { success: true };
}

/** Lists categories for authenticated administrative management. */
export async function getCategories(siteId: string): Promise<CategoryRecord[]> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listCategoriesForSite(siteId);
}

/** Lists public category navigation items for a blog site. */
export async function getPublicCategories(siteId: string): Promise<CategoryRecord[]> {
  return listCategoriesForSite(siteId);
}
