"use server";

import { getDb } from "@/lib/db";
import { users, sites, posts } from "@/lib/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { generateId } from "@/lib/utils/slug";
import {
  createUserSchema,
  updateUserSchema,
  validate,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/security/validate";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from user mutation operations.
 */
export type UserMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Detailed user model representation for administrative team lists.
 */
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "super_admin" | "admin" | "editor" | "author";
  siteId: string | null;
  siteName: string | null;
  postCount: number;
  createdAt: Date;
}

/**
 * Retrieves all registered users accessible to the authenticated administrator.
 * Super administrators receive users across all sites, while site administrators receive users assigned to their site.
 *
 * @param siteId - Optional filter to restrict results to a specific site.
 * @returns A Promise resolving to an array of UserRecord objects.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function getUsers(siteId?: string): Promise<UserRecord[]> {
  const currentUser = await requireAuth(["super_admin", "admin"]);
  const db = getDb();

  let query = db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      siteId: users.siteId,
      createdAt: users.createdAt,
      siteName: sites.name,
      postCount: sql<number>`(SELECT count(*) FROM ${posts} WHERE ${posts.authorId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(sites, eq(users.siteId, sites.id))
    .orderBy(desc(users.createdAt));

  let rows;
  if (currentUser.role === "super_admin") {
    if (siteId) {
      rows = query.where(eq(users.siteId, siteId)).all();
    } else {
      rows = query.all();
    }
  } else {
    const effectiveSiteId = currentUser.siteId || siteId || "";
    if (effectiveSiteId) {
      rows = query.where(eq(users.siteId, effectiveSiteId)).all();
    } else {
      rows = query.where(eq(users.id, currentUser.userId)).all();
    }
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    role: r.role as "super_admin" | "admin" | "editor" | "author",
    siteId: r.siteId,
    siteName: r.siteName || null,
    postCount: Number(r.postCount) || 0,
    createdAt: new Date(r.createdAt),
  }));
}

/**
 * Creates a new user account with role-based access control and Argon2id password hashing.
 *
 * @param {Partial<CreateUserInput>} inputData - User creation payload.
 * @returns {Promise<UserMutationResponse>} A Promise resolving to a UserMutationResponse.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function createUser(inputData: Partial<CreateUserInput>): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(["super_admin", "admin"]);
  const db = getDb();

  const candidateRole = inputData.role || "author";
  let targetSiteId = inputData.siteId || null;

  if (currentUser.role === "admin") {
    if (candidateRole === "super_admin" || candidateRole === "admin") {
      return { success: false, error: "Admins can only create Editor or Author accounts." };
    }
    targetSiteId = currentUser.siteId || null;
  }

  const validation = validate(createUserSchema, {
    ...inputData,
    role: candidateRole,
    siteId: targetSiteId,
  });

  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { email, displayName, password, role, avatarUrl, siteId } = validation.data;
  const cleanEmail = email.toLowerCase().trim();

  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).get();
  if (existing) {
    return { success: false, errors: { email: ["This email is already registered."] } };
  }

  const passwordHash = await hashPassword(password);
  const id = generateId();

  db.insert(users)
    .values({
      id,
      email: cleanEmail,
      displayName: displayName.trim(),
      passwordHash,
      role,
      avatarUrl: avatarUrl || null,
      siteId: siteId || null,
      createdAt: new Date(),
    })
    .run();

  revalidatePath("/", "layout");
  revalidatePath("/[locale]/admin/users", "page");
  return { success: true, id };
}

/**
 * Updates an existing user's profile, role, site assignment, or password.
 *
 * @param {string} userId - Unique identifier of the user to modify.
 * @param {Partial<UpdateUserInput>} inputData - Partial user payload with updated values.
 * @returns {Promise<UserMutationResponse>} A Promise resolving to a UserMutationResponse.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function updateUser(
  userId: string,
  inputData: Partial<UpdateUserInput>
): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(["super_admin", "admin"]);
  const db = getDb();

  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  if (currentUser.role === "admin") {
    if (targetUser.role === "super_admin") {
      return { success: false, error: "You cannot edit a super administrator account." };
    }
    if (inputData.role === "super_admin") {
      return { success: false, error: "You cannot assign the super administrator role." };
    }
    if (targetUser.siteId !== currentUser.siteId && targetUser.id !== currentUser.userId) {
      return { success: false, error: "You can only manage users within your assigned site." };
    }
  }

  if (targetUser.role === "super_admin" && inputData.role && inputData.role !== "super_admin") {
    const adminCount = db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "super_admin"))
      .get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot demote the last super administrator." };
    }
  }

  const validation = validate(updateUserSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { email, displayName, password, role, avatarUrl, siteId } = validation.data;
  const updates: Record<string, any> = {};

  if (displayName) updates.displayName = displayName.trim();
  if (role) updates.role = role;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
  if (siteId !== undefined) updates.siteId = siteId || null;

  if (email) {
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail !== targetUser.email) {
      const existing = db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).get();
      if (existing) {
        return { success: false, errors: { email: ["This email is already registered."] } };
      }
      updates.email = cleanEmail;
    }
  }

  if (password && password.trim().length > 0) {
    updates.passwordHash = await hashPassword(password);
  }

  if (Object.keys(updates).length > 0) {
    db.update(users).set(updates).where(eq(users.id, userId)).run();
  }

  revalidatePath("/", "layout");
  revalidatePath("/[locale]/admin/users", "page");
  return { success: true, id: userId };
}

/**
 * Deletes a user account with safeguards against self-deletion and removing the last super administrator.
 *
 * @param userId - Unique identifier of the user to delete.
 * @returns A Promise resolving to a UserMutationResponse.
 * @throws {Error} When the caller lacks an authorized administrative role.
 */
export async function deleteUser(userId: string): Promise<UserMutationResponse> {
  const currentUser = await requireAuth(["super_admin", "admin"]);
  const db = getDb();

  if (userId === currentUser.userId) {
    return { success: false, error: "You cannot delete your own account while logged in." };
  }

  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  if (targetUser.role === "super_admin") {
    if (currentUser.role !== "super_admin") {
      return { success: false, error: "Only super administrators can delete super administrator accounts." };
    }
    const adminCount = db
      .select({ count: count() })
      .from(users)
      .where(eq(users.role, "super_admin"))
      .get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot delete the last super administrator." };
    }
  }

  if (currentUser.role === "admin") {
    if (targetUser.siteId !== currentUser.siteId) {
      return { success: false, error: "You can only delete users assigned to your site." };
    }
  }

  db.delete(users).where(eq(users.id, userId)).run();

  revalidatePath("/", "layout");
  revalidatePath("/[locale]/admin/users", "page");
  return { success: true };
}
