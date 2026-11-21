import { getDb } from "@/lib/db";
import { categories, tags } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { generateId, generateSlug } from "@/lib/utils/slug";
import type { CategoryInput, TagInput } from "@/lib/contracts";

/** Result payload returned from category mutations. */
export type CategoryMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/** Plain object representation of a persisted category record. */
export interface CategoryRecord {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
}

/** Result payload returned from tag creation operations. */
export type TagMutationResponse =
  | { success: true; id: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/** Plain object representation of a persisted taxonomy tag record. */
export interface TagRecord {
  id: string;
  siteId: string;
  name: string;
  slug: string;
}

export function createCategoryService(siteId: string, data: CategoryInput): CategoryMutationResponse {
  const { name, slug, description, parentId, sortOrder } = data;
  const db = getDb();
  const id = generateId();
  const catSlug = slug ? generateSlug(slug) : generateSlug(name);

  const duplicate = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.siteId, siteId), eq(categories.slug, catSlug)))
    .get();
  if (duplicate) {
    return { success: false, errors: { slug: ["A category with this slug already exists in this site."] } };
  }

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

  return { success: true, id };
}

export function getCategorySiteId(categoryId: string): string | null {
  return (
    getDb().select({ siteId: categories.siteId }).from(categories).where(eq(categories.id, categoryId)).get()?.siteId ||
    null
  );
}

export function updateCategoryService(
  categoryId: string,
  siteId: string,
  data: CategoryInput
): CategoryMutationResponse {
  const { name, slug, description, parentId, sortOrder } = data;
  const db = getDb();
  const catSlug = slug ? generateSlug(slug) : generateSlug(name);

  const duplicate = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.siteId, siteId), eq(categories.slug, catSlug), ne(categories.id, categoryId)))
    .get();
  if (duplicate) {
    return { success: false, errors: { slug: ["A category with this slug already exists in this site."] } };
  }

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

  return { success: true };
}

export function deleteCategoryService(categoryId: string): void {
  getDb().delete(categories).where(eq(categories.id, categoryId)).run();
}

export function listCategoriesForSite(siteId: string): CategoryRecord[] {
  return getDb()
    .select()
    .from(categories)
    .where(eq(categories.siteId, siteId))
    .orderBy(categories.sortOrder, categories.name)
    .all();
}

export function createTagService(siteId: string, data: TagInput): TagMutationResponse {
  const { name, slug } = data;
  const db = getDb();
  const id = generateId();
  const tagSlug = slug ? generateSlug(slug) : generateSlug(name);

  const duplicate = db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.siteId, siteId), eq(tags.slug, tagSlug)))
    .get();
  if (duplicate) {
    return { success: false, errors: { slug: ["A tag with this slug already exists in this site."] } };
  }

  db.insert(tags).values({ id, siteId, name, slug: tagSlug }).run();
  return { success: true, id };
}

export function getTagSiteId(tagId: string): string | null {
  return getDb().select({ siteId: tags.siteId }).from(tags).where(eq(tags.id, tagId)).get()?.siteId || null;
}

export function deleteTagService(tagId: string): void {
  getDb().delete(tags).where(eq(tags.id, tagId)).run();
}

export function listTagsForSite(siteId: string): TagRecord[] {
  return getDb().select().from(tags).where(eq(tags.siteId, siteId)).orderBy(tags.name).all();
}
