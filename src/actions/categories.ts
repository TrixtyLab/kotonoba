"use server";

import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { categorySchema, validate, type CategoryInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

export type CategoryMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

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
 * Creates a category under the specified site.
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
 * Updates a category details.
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
 * Deletes a category.
 */
export async function deleteCategory(categoryId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin"]);
  const db = getDb();
  db.delete(categories).where(eq(categories.id, categoryId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all categories for a given site.
 */
export async function getCategories(siteId: string): Promise<CategoryRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(categories)
    .where(eq(categories.siteId, siteId))
    .all();
}
