"use server";

import { getDb } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { tagSchema, validate, type TagInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from tag creation operations.
 */
export type TagMutationResponse =
  | { success: true; id: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Plain object representation of a persisted taxonomy tag record.
 */
export interface TagRecord {
  id: string;
  siteId: string;
  name: string;
  slug: string;
}

/**
 * Creates a new taxonomy tag under the specified tenant site.
 *
 * @param siteId - Unique database identifier of the target site.
 * @param inputData - Tag creation attributes containing tag name and optional custom slug.
 * @returns A Promise resolving to a TagMutationResponse with the created tag ID or validation errors.
 * @throws {Error} When the caller lacks an authorized author, editor, or administrator role.
 */
export async function createTag(siteId: string, inputData: Partial<TagInput>): Promise<TagMutationResponse> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);
  const validation = validate(tagSchema, inputData);

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { name, slug } = validation.data;
  const db = getDb();
  const id = generateId();
  const tagSlug = slug ? generateSlug(slug) : generateSlug(name);

  db.insert(tags)
    .values({
      id,
      siteId,
      name,
      slug: tagSlug,
    })
    .run();

  revalidatePath("/", "layout");
  return { success: true, id };
}

/**
 * Deletes a taxonomy tag by ID and removes all associated post-tag relationships.
 *
 * @param tagId - Unique database identifier of the tag to remove.
 * @returns A Promise resolving to an object indicating success.
 * @throws {Error} When the caller lacks an authorized editorial or administrative role.
 */
export async function deleteTag(tagId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const db = getDb();
  db.delete(tags).where(eq(tags.id, tagId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all taxonomy tags registered under a given tenant site.
 *
 * @param siteId - Unique database identifier of the target site.
 * @returns A Promise resolving to an array of TagRecord objects.
 */
export async function getTags(siteId: string): Promise<TagRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(tags)
    .where(eq(tags.siteId, siteId))
    .orderBy(tags.name)
    .all();
}
