"use server";

import { ROLE_ADMINS } from "@/lib/auth/roles";
import { requireAuth } from "@/lib/auth/session";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateUsersAdmin } from "@/lib/cache/revalidate";
import { type CreateUserInput, type UpdateUserInput } from "@/lib/security/validate";
import {
  createUserService,
  deleteUserService,
  listUsersForActor,
  updateUserService,
  type UserMutationResponse,
  type UserRecord,
} from "@/lib/services/users";

export type { UserMutationResponse, UserRecord };

/** Lists users visible to the authenticated administrator. */
export async function getUsers(siteId?: string): Promise<UserRecord[]> {
  const currentUser = await requireAuth(ROLE_ADMINS);
  if (siteId) {
    await requireSiteAccess(siteId, ROLE_ADMINS);
  }
  return listUsersForActor(currentUser, siteId);
}

/** Creates a new user account scoped cleanly to role hierarchy and tenant rules. */
export async function createUser(inputData: Partial<CreateUserInput>): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(ROLE_ADMINS);
  const res = await createUserService(currentUser, inputData);
  if (res.success) revalidateUsersAdmin();
  return res;
}

/** Updates an existing user's profile, role, site assignment, or password with session revocation. */
export async function updateUser(
  userId: string,
  inputData: Partial<UpdateUserInput>
): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(ROLE_ADMINS);
  const res = await updateUserService(currentUser, userId, inputData);
  if (res.success) revalidateUsersAdmin();
  return res;
}

/** Deletes a user account subject to self-protection and last-super-admin safeguards. */
export async function deleteUser(userId: string): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(ROLE_ADMINS);
  const res = deleteUserService(currentUser, userId);
  if (res.success) revalidateUsersAdmin();
  return res;
}
