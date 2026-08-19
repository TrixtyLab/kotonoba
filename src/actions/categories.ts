"use server";

import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { categorySchema, validate, type CategoryInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from category creation or update operations.
 */
export type CategoryMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Plain object representation of a persisted category record.
 */
export interface CategoryRecord {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
}

/**
 * Creates a new category classification under a specific blog site.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param inputData - Category attributes including name, custom slug, description, and hierarchy order.
 * @returns A Promise resolving to a CategoryMutationResponse with the created category ID or validation errors.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function createCategory(siteId: string, inputData: Partial<CategoryInput>): Promise<CategoryMutationResponse> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const validation = validate(categorySchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, slug, description, parentId, sortOrder } = validation.data;
  const db = getDb();
  const id = generateId();
  const catSlug = slug ? generateSlug(slug) : generateSlug(name);

  db.insert(categories)
    .values({
      id,
      siteId,
      name,
      slug: catSlug,
      description: description || "",
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
    })
    .run();

  revalidatePath("/", "layout");
  return { success: true, id };
}

/**
 * Updates an existing category's name, slug, description, or sort hierarchy.
 *
 * @param categoryId - Unique database identifier of the category to update.
 * @param inputData - Updated category attributes.
 * @returns A Promise resolving to a CategoryMutationResponse indicating success status or validation errors.
 * @throws {Error} When the caller lacks an authorized administrative or editorial role.
 */
export async function updateCategory(categoryId: string, inputData: Partial<CategoryInput>): Promise<CategoryMutationResponse> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const validation = validate(categorySchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, slug, description, parentId, sortOrder } = validation.data;
  const db = getDb();
  const catSlug = slug ? generateSlug(slug) : generateSlug(name);

  db.update(categories)
    .set({
      name,
      slug: catSlug,
      description: description || "",
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
    })
    .where(eq(categories.id, categoryId))
    .run();

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Deletes a category by ID and removes all associated post-category relations.
 *
 * @param categoryId - Unique database identifier of the category to delete.
 * @returns A Promise resolving to an object indicating success.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function deleteCategory(categoryId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin"]);
  const db = getDb();
  db.delete(categories).where(eq(categories.id, categoryId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all categories associated with a given site, ordered by sort hierarchy.
 *
 * @param siteId - Unique database identifier of the target site.
 * @returns A Promise resolving to an array of CategoryRecord objects.
 */
export async function getCategories(siteId: string): Promise<CategoryRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(categories)
    .where(eq(categories.siteId, siteId))
    .orderBy(categories.sortOrder, categories.name)
    .all();
}
