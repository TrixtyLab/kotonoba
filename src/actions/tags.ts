"use server";

import { getDb } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { tagSchema, validate, type TagInput } from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

export type TagMutationResponse =
  | { success: true; id: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

export interface TagRecord {
  id: string;
  siteId: string;
  name: string;
  slug: string;
}

/**
 * Creates a new tag for the site.
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
 * Deletes a tag.
 */
export async function deleteTag(tagId: string): Promise<{ success: true }> {
  await requireAuth(["super_admin", "admin", "editor"]);
  const db = getDb();
  db.delete(tags).where(eq(tags.id, tagId)).run();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Retrieves all tags for a given site.
 */
export async function getTags(siteId: string): Promise<TagRecord[]> {
  const db = getDb();
  return db
    .select()
    .from(tags)
    .where(eq(tags.siteId, siteId))
    .all();
}
