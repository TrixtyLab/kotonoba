"use server";

import { ROLE_ALL, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateSiteShell } from "@/lib/cache/revalidate";
import { validate } from "@/lib/security/validate";
import { tagSchema, type TagInput } from "@/lib/contracts";
import {
  createTagService,
  deleteTagService,
  getTagSiteId,
  listTagsForSite,
  type TagMutationResponse,
  type TagRecord,
} from "@/lib/services/taxonomy";

export type { TagMutationResponse, TagRecord };

/** Creates a taxonomy tag within an authorized tenant site. */
export async function createTag(siteId: string, inputData: Partial<TagInput>): Promise<TagMutationResponse> {
  await requireSiteAccess(siteId, ROLE_ALL);
  const validation = validate(tagSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const res = createTagService(siteId, validation.data);
  if (res.success) revalidateSiteShell(siteId);
  return res;
}

/** Deletes a taxonomy tag by ID. */
export async function deleteTag(tagId: string): Promise<{ success: boolean; error?: string }> {
  const siteId = getTagSiteId(tagId);
  if (!siteId) return { success: false, error: "Tag not found" };

  await requireSiteAccess(siteId, ROLE_PUBLISHERS);
  deleteTagService(tagId);
  revalidateSiteShell(siteId);
  return { success: true };
}

/** Retrieves all taxonomy tags belonging to a tenant site. */
export async function getTags(siteId: string): Promise<TagRecord[]> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listTagsForSite(siteId);
}
