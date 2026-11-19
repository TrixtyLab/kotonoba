import { getDb } from "@/lib/db";
import { users, sites, posts } from "@/lib/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import type { TokenPayload } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { generateId } from "@/lib/utils/slug";
import { createUserSchema, updateUserSchema, validate, type CreateUserInput, type UpdateUserInput } from "@/lib/security/validate";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { recordAuditEvent } from "@/lib/security/audit";

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
  role: "super_admin" | "admin" | "editor" | "author";
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
  if (actor.role === "super_admin") {
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
    role: r.role as "super_admin" | "admin" | "editor" | "author",
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
  const candidateRole = inputData.role || "author";
  let targetSiteId = inputData.siteId || null;

  if (actor.role === "admin") {
    if (!actor.siteId) {
      return { success: false, error: "Your account is not assigned to a site." };
    }
    if (candidateRole === "super_admin" || candidateRole === "admin") {
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

export async function updateUserService(
  actor: TokenPayload,
  userId: string,
  inputData: Partial<UpdateUserInput>
): Promise<UserMutationResponse> {
  const db = getDb();
  const targetUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  if (actor.role === "admin") {
    if (!actor.siteId) {
      return { success: false, error: "Your account is not assigned to a site." };
    }
    if (targetUser.role === "super_admin") {
      return { success: false, error: "You cannot edit a super administrator account." };
    }
    if (inputData.role === "super_admin" || inputData.role === "admin") {
      return { success: false, error: "You cannot assign administrator roles." };
    }
    if (targetUser.siteId !== actor.siteId && targetUser.id !== actor.userId) {
      return { success: false, error: "You can only manage users within your assigned site." };
    }
    if (inputData.siteId !== undefined && inputData.siteId !== actor.siteId) {
      return { success: false, error: "You cannot move users to another site." };
    }
  }

  if (targetUser.role === "super_admin" && inputData.role && inputData.role !== "super_admin") {
    const adminCount = db.select({ count: count() }).from(users).where(eq(users.role, "super_admin")).get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot demote the last super administrator." };
    }
  }

  const validation = validate(updateUserSchema, inputData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { email, displayName, password, role, avatarUrl, siteId } = validation.data;
  const updates: Partial<typeof users.$inferInsert> = {};
  let shouldRevokeSessions = false;

  if (displayName) updates.displayName = displayName.trim();
  if (role && role !== targetUser.role) {
    updates.role = role;
    shouldRevokeSessions = true;
  }
  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl ? sanitizeUrl(avatarUrl, { allowRelative: true }) : null;
  }
  if (siteId !== undefined) {
    const normalizedSiteId = siteId || null;
    if (normalizedSiteId) {
      const targetSite = db.select({ id: sites.id }).from(sites).where(eq(sites.id, normalizedSiteId)).get();
      if (!targetSite) {
        return { success: false, error: "Selected site does not exist." };
      }
    }
    if (normalizedSiteId !== targetUser.siteId) {
      updates.siteId = normalizedSiteId;
      shouldRevokeSessions = true;
    }
  }

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
    shouldRevokeSessions = true;
  }

  if (shouldRevokeSessions) {
    updates.tokenVersion = targetUser.tokenVersion + 1;
  }

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

  if (targetUser.role === "super_admin") {
    if (actor.role !== "super_admin") {
      return { success: false, error: "Only super administrators can delete super administrator accounts." };
    }
    const adminCount = db.select({ count: count() }).from(users).where(eq(users.role, "super_admin")).get();
    if ((adminCount?.count ?? 0) <= 1) {
      return { success: false, error: "Cannot delete the last super administrator." };
    }
  }

  if (actor.role === "admin") {
    if (!actor.siteId || targetUser.siteId !== actor.siteId) {
      return { success: false, error: "You can only delete users assigned to your site." };
    }
  }

  db.delete(users).where(eq(users.id, userId)).run();

  recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    siteId: targetUser.siteId,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    metadata: { email: targetUser.email, role: targetUser.role },
  });

  return { success: true };
}
