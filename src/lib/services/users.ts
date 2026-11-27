import { getDb } from "@/lib/db";
import { users, sites, posts, pages } from "@/lib/db/schema";
import { and, eq, sql, desc, count, ne } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { generateId } from "@/lib/utils/slug";
import { validate } from "@/lib/security/validate";
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from "@/lib/contracts";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { recordAuditEvent } from "@/lib/security/audit";
import { ROLES, type UserRole } from "@/lib/config/constants";

/** Result payload returned from user mutation operations. */
export type UserMutationResponse =
  | { success: true; id?: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/** Plain object representation of a registered user record for UI lists. */
export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  siteId: string | null;
  siteName: string | null;
  postCount: number;
  createdAt: Date;
}

export function listUsersForActor(actor: TokenPayload, siteId?: string): UserRecord[] {
  const db = getDb();
  const query = db
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
  if (actor.role === ROLES.SUPER_ADMIN) {
    rows = siteId ? query.where(eq(users.siteId, siteId)).all() : query.all();
  } else {
    const effectiveSiteId = actor.siteId || siteId || "";
    rows = effectiveSiteId
      ? query.where(eq(users.siteId, effectiveSiteId)).all()
      : query.where(eq(users.id, actor.userId)).all();
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    role: r.role as UserRole,
    siteId: r.siteId,
    siteName: r.siteName || null,
    postCount: Number(r.postCount) || 0,
    createdAt: new Date(r.createdAt),
  }));
}

export async function createUserService(
  actor: TokenPayload,
  inputData: Partial<CreateUserInput>
): Promise<UserMutationResponse> {
  const db = getDb();
  const candidateRole = inputData.role || ROLES.AUTHOR;
  let targetSiteId = inputData.siteId || null;

  if (actor.role === ROLES.ADMIN) {
    if (!actor.siteId) {
      return { success: false, error: "Your account is not assigned to a site." };
    }
    if (candidateRole === ROLES.SUPER_ADMIN || candidateRole === ROLES.ADMIN) {
      return { success: false, error: "Admins can only create Editor or Author accounts." };
    }
    targetSiteId = actor.siteId;
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

  if (siteId) {
    const targetSite = db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
    if (!targetSite) {
      return { success: false, error: "Selected site does not exist." };
    }
  }

  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).get();
  if (existing) {
    return { success: false, errors: { email: ["This email is already registered."] } };
  }

  const passwordHash = await hashPassword(password);
  const id = generateId();
  const safeAvatarUrl = avatarUrl ? sanitizeUrl(avatarUrl, { allowRelative: true }) : null;

  db.insert(users)
    .values({
      id,
      email: cleanEmail,
      displayName: displayName.trim(),
      passwordHash,
      role,
      avatarUrl: safeAvatarUrl,
      siteId: siteId || null,
      tokenVersion: 1,
      createdAt: new Date(),
    })
    .run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: siteId || null,
    action: "user.create",
    targetType: "user",
    targetId: id,
    metadata: { email: cleanEmail, role },
  });

  return { success: true, id };
}

function isLastSiteAdmin(siteId: string | null, excludedUserId: string): boolean {
  if (!siteId) return false;
  const row = getDb()
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.siteId, siteId), eq(users.role, ROLES.ADMIN), ne(users.id, excludedUserId)))
    .get();
  return (row?.count ?? 0) === 0;
}

function validateTenantAdminUserScope(
  actor: TokenPayload,
  targetUser: typeof users.$inferSelect,
  inputData: Partial<UpdateUserInput>
): UserMutationResponse | null {
  if (!actor.siteId) return { success: false, error: "Your account is not assigned to a site." };
  if (targetUser.role === ROLES.SUPER_ADMIN) {
    return { success: false, error: "You cannot edit a super administrator account." };
  }
  if (targetUser.role === ROLES.ADMIN && targetUser.id !== actor.userId) {
    return { success: false, error: "Administrators cannot modify other administrator accounts." };
  }
  if (targetUser.id === actor.userId && inputData.role && inputData.role !== targetUser.role) {
    return { success: false, error: "You cannot change your own role." };
  }
  if (inputData.role === ROLES.SUPER_ADMIN || inputData.role === ROLES.ADMIN) {
    return { success: false, error: "You cannot assign administrator roles." };
  }
  if (targetUser.siteId !== actor.siteId && targetUser.id !== actor.userId) {
    return { success: false, error: "You can only manage users within your assigned site." };
  }
  if (inputData.siteId !== undefined && inputData.siteId !== actor.siteId) {
    return { success: false, error: "You cannot move users to another site." };
  }
  return null;
}

function authorizeUserUpdatePermission(
  actor: TokenPayload,
  targetUser: typeof users.$inferSelect,
  inputData: Partial<UpdateUserInput>
): UserMutationResponse | null {
  if (actor.role === ROLES.ADMIN) {
    const scopeError = validateTenantAdminUserScope(actor, targetUser, inputData);
    if (scopeError) return scopeError;
  }

  if (
    targetUser.role === ROLES.ADMIN &&
    inputData.role &&
    inputData.role !== ROLES.ADMIN &&
    isLastSiteAdmin(targetUser.siteId, targetUser.id)
  ) {
    return { success: false, error: "Cannot demote the last administrator of this site." };
  }

  if (targetUser.role === ROLES.SUPER_ADMIN && inputData.role && inputData.role !== ROLES.SUPER_ADMIN) {
    const adminCount = getDb().select({ count: count() }).from(users).where(eq(users.role, ROLES.SUPER_ADMIN)).get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot demote the last super administrator." };
    }
  }

  return null;
}

function resolveUserSiteChange(
  nextSiteId: string | null | undefined,
  currentSiteId: string | null
): { siteId?: string | null; changed: boolean; errorResponse?: UserMutationResponse } {
  if (nextSiteId === undefined) return { changed: false };
  const normalizedSiteId = nextSiteId || null;
  if (normalizedSiteId && !getDb().select({ id: sites.id }).from(sites).where(eq(sites.id, normalizedSiteId)).get()) {
    return { changed: false, errorResponse: { success: false, error: "Selected site does not exist." } };
  }
  return { siteId: normalizedSiteId, changed: normalizedSiteId !== currentSiteId };
}

function resolveUserEmailChange(
  nextEmail: string | undefined,
  currentEmail: string
): { email?: string; errorResponse?: UserMutationResponse } {
  if (!nextEmail) return {};
  const cleanEmail = nextEmail.toLowerCase().trim();
  if (cleanEmail === currentEmail) return {};
  if (getDb().select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).get()) {
    return { errorResponse: { success: false, errors: { email: ["This email is already registered."] } } };
  }
  return { email: cleanEmail };
}

async function buildUserUpdatePatch(
  targetUser: typeof users.$inferSelect,
  data: Partial<UpdateUserInput>
): Promise<{
  updates?: Partial<typeof users.$inferInsert>;
  shouldRevokeSessions?: boolean;
  errorResponse?: UserMutationResponse;
}> {
  const updates: Partial<typeof users.$inferInsert> = {};
  let shouldRevokeSessions = false;

  if (data.displayName) updates.displayName = data.displayName.trim();
  if (data.role && data.role !== targetUser.role) {
    updates.role = data.role;
    shouldRevokeSessions = true;
  }
  if (data.avatarUrl !== undefined) {
    updates.avatarUrl = data.avatarUrl ? sanitizeUrl(data.avatarUrl, { allowRelative: true }) : null;
  }

  const siteRes = resolveUserSiteChange(data.siteId, targetUser.siteId);
  if (siteRes.errorResponse) return { errorResponse: siteRes.errorResponse };
  if (siteRes.changed) {
    updates.siteId = siteRes.siteId;
    shouldRevokeSessions = true;
  }

  const emailRes = resolveUserEmailChange(data.email, targetUser.email);
  if (emailRes.errorResponse) return { errorResponse: emailRes.errorResponse };
  if (emailRes.email) updates.email = emailRes.email;

  if (data.password?.trim()) {
    updates.passwordHash = await hashPassword(data.password);
    shouldRevokeSessions = true;
  }
  if (shouldRevokeSessions) updates.tokenVersion = targetUser.tokenVersion + 1;
  return { updates, shouldRevokeSessions };
}

export async function updateUserService(
  actor: TokenPayload,
  userId: string,
  inputData: Partial<UpdateUserInput>
): Promise<UserMutationResponse> {
  const db = getDb();
  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) return { success: false, error: "User not found." };

  const authError = authorizeUserUpdatePermission(actor, targetUser, inputData);
  if (authError) return authError;

  const validation = validate(updateUserSchema, inputData);
  if (!validation.success) return { success: false, errors: validation.errors };

  const { updates, shouldRevokeSessions = false, errorResponse } = await buildUserUpdatePatch(
    targetUser,
    validation.data
  );
  if (errorResponse || !updates) return errorResponse || { success: false, error: "Invalid update payload." };

  if (Object.keys(updates).length > 0) {
    db.update(users).set(updates).where(eq(users.id, userId)).run();
    recordAuditEvent({
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      siteId: updates.siteId !== undefined ? updates.siteId : targetUser.siteId,
      action: updates.role ? "user.role_change" : "user.update",
      targetType: "user",
      targetId: userId,
      metadata: {
        previousRole: targetUser.role,
        nextRole: updates.role || targetUser.role,
        sessionsRevoked: shouldRevokeSessions,
      },
    });
  }

  return { success: true, id: userId };
}

export function deleteUserService(actor: TokenPayload, userId: string): UserMutationResponse {
  const db = getDb();

  if (userId === actor.userId) {
    return { success: false, error: "You cannot delete your own account while logged in." };
  }

  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  if (targetUser.role === ROLES.SUPER_ADMIN) {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      return { success: false, error: "Only super administrators can delete super administrator accounts." };
    }
    const adminCount = db.select({ count: count() }).from(users).where(eq(users.role, ROLES.SUPER_ADMIN)).get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot delete the last super administrator." };
    }
  }

  if (actor.role === ROLES.ADMIN) {
    if (!actor.siteId || targetUser.siteId !== actor.siteId) {
      return { success: false, error: "You can only delete users assigned to your site." };
    }
    if (targetUser.role === ROLES.ADMIN) {
      return { success: false, error: "Administrators cannot delete other administrator accounts." };
    }
  }

  if (targetUser.role === ROLES.ADMIN && isLastSiteAdmin(targetUser.siteId, targetUser.id)) {
    return { success: false, error: "Cannot delete the last administrator of this site." };
  }

  const { reassignedPosts, reassignedPages } = db.transaction((tx) => {
    const postResult = tx
      .update(posts)
      .set({ authorId: actor.userId })
      .where(eq(posts.authorId, userId))
      .run();
    const pageResult = tx
      .update(pages)
      .set({ authorId: actor.userId })
      .where(eq(pages.authorId, userId))
      .run();
    tx.delete(users).where(eq(users.id, userId)).run();
    return { reassignedPosts: postResult.changes, reassignedPages: pageResult.changes };
  });

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: targetUser.siteId,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    metadata: {
      email: targetUser.email,
      role: targetUser.role,
      previousAuthorId: userId,
      reassignedPosts,
      reassignedPages,
      nextAuthorId: actor.userId,
    },
  });

  return { success: true };
}
