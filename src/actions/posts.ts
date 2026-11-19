"use server";

import { ROLE_ALL, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireResourceAccess, requireSiteAccess } from "@/lib/auth/site-access";
import { revalidatePostPaths } from "@/lib/cache/revalidate";
import { postSchema, validate, type PostInput } from "@/lib/security/validate";
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
    revalidatePostPaths(postSlug);
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
    revalidatePostPaths(postSlug, existing.slug);
  }
  return result;
}

/** Permanently removes a blog article, its Dub link, and its analytics rows. */
export async function deletePost(postId: string): Promise<{ success: true }> {
  const { user } = await requireResourceAccess("post", postId, ROLE_PUBLISHERS);
  const { deletedSlug } = await deletePostService(user, postId);
  revalidatePostPaths(deletedSlug);
  return { success: true };
}

/** Lists all posts for administrative management in a tenant site. */
export async function getAdminPosts(siteId: string): Promise<AdminPostRecord[]> {
  await requireSiteAccess(siteId, ROLE_ALL);
  return listAdminPosts(siteId);
}
