"use server";

import { ROLE_ALL } from "@/lib/auth/roles";
import { requireResourceAccess, requireSiteAccess } from "@/lib/auth/site-access";
import { revalidatePostPaths } from "@/lib/cache/revalidate";
import { validate } from "@/lib/security/validate";
import { postSchema, type PostInput } from "@/lib/contracts";
import {
  createPostService,
  deletePostService,
  getExistingPostMeta,
  listAdminPosts,
  updatePostService,
  type AdminPostRecord,
  type PostMutationResponse,
} from "@/lib/services/posts";

export type { AdminPostRecord, PostMutationResponse };

/** Creates a new blog article after authenticating and validating payload schema. */
export async function createPost(siteId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const actor = await requireSiteAccess(siteId, ROLE_ALL);
  const validation = validate(postSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { result, postSlug } = await createPostService(actor, siteId, validation.data);
  if (result.success) {
    revalidatePostPaths(postSlug, null, siteId);
  }
  return result;
}

/** Updates an existing blog article and refreshes public/admin caches. */
export async function updatePost(postId: string, inputData: Partial<PostInput>): Promise<PostMutationResponse> {
  const validation = validate(postSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const existing = getExistingPostMeta(postId);
  if (!existing) {
    return { success: false, error: "Article not found" };
  }

  const actor = await requireSiteAccess(existing.siteId, ROLE_ALL);
  const { result, postSlug } = await updatePostService(actor, existing, validation.data);
  if (result.success) {
    revalidatePostPaths(postSlug, existing.slug, existing.siteId);
  }
  return result;
}

/** Permanently removes a blog article, its Dub link, and its analytics rows. */
export async function deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
  const { user } = await requireResourceAccess("post", postId, ROLE_ALL);
  const res = await deletePostService(user, postId);
  if (!res.success) {
    return { success: false, error: res.error };
  }
  revalidatePostPaths(res.deletedSlug, null, res.siteId);
  return { success: true };
}

/** Lists all posts for administrative management in a tenant site. */
export async function getAdminPosts(siteId: string): Promise<AdminPostRecord[]> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listAdminPosts(siteId);
}
