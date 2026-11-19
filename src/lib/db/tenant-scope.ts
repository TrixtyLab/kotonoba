import { getDb } from "@/lib/db";
import { categories, tags } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Verifies that every taxonomy identifier belongs to the given tenant site.
 *
 * Client-supplied category and tag IDs must never be trusted: without this
 * check an editor could attach content from one site to another tenant's
 * taxonomy. Duplicate IDs are collapsed before comparing counts.
 *
 * @param siteId - Tenant that owns the post being written.
 * @param categoryIds - Category identifiers submitted by the client.
 * @param tagIds - Tag identifiers submitted by the client.
 * @returns `true` when all identifiers exist under the tenant.
 */
export function taxonomyBelongsToSite(
  siteId: string,
  categoryIds: string[] = [],
  tagIds: string[] = []
): boolean {
  const db = getDb();
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const uniqueTagIds = [...new Set(tagIds)];

  if (uniqueCategoryIds.length > 0) {
    const found = db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.siteId, siteId), inArray(categories.id, uniqueCategoryIds)))
      .all();

    if (found.length !== uniqueCategoryIds.length) {
      return false;
    }
  }

  if (uniqueTagIds.length > 0) {
    const found = db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.siteId, siteId), inArray(tags.id, uniqueTagIds)))
      .all();

    if (found.length !== uniqueTagIds.length) {
      return false;
    }
  }

  return true;
}
