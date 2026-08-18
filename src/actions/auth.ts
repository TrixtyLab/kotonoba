"use server";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import { loginSchema, registerSchema, validate, type LoginInput, type RegisterInput } from "@/lib/security/validate";
import { generateId } from "@/lib/utils/slug";

export type AuthResponse =
  | { success: true; user: { id: string; email: string; role: string } }
  | { success: false; error?: string; errors?: Record<string, string[]> };

export type RegisterResponse =
  | { success: true; userId: string }
  | { success: false; error?: string; errors?: Record<string, string[]> };

/**
 * Authenticates a user, verifies credentials, and issues httpOnly session cookies.
 */
export async function loginAction(formData: Partial<LoginInput>): Promise<AuthResponse> {
  const validation = validate(loginSchema, formData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const { email, password } = validation.data;
  const db = getDb();
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { success: false, error: "Invalid email or password" };
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    siteId: user.siteId,
  });
  const refreshToken = await signRefreshToken(user.id);

  const cookieStore = await cookies();
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { success: true, user: { id: user.id, email: user.email, role: user.role } };
}

/**
 * Registers the initial super_admin user if no administrator exists.
 */
export async function registerInitialAdmin(formData: Partial<RegisterInput>): Promise<RegisterResponse> {
  const validation = validate(registerSchema, formData);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  const db = getDb();
  const existingAdmin = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(or(eq(users.role, "super_admin"), eq(users.role, "admin")))
    .get();

  if (existingAdmin && existingAdmin.count > 0) {
    return { success: false, error: "An administrator already exists. Please log in." };
  }

  const { email, password, displayName } = validation.data;
  const passwordHash = await hashPassword(password);
  const userId = generateId();

  db.insert(users)
    .values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      role: "super_admin",
      createdAt: new Date(),
    })
    .run();

  const accessToken = await signAccessToken({
    userId,
    email: email.toLowerCase(),
    role: "super_admin",
    siteId: null,
  });

  const cookieStore = await cookies();
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  return { success: true, userId };
}

/**
 * Clears authentication session cookies.
 */
export async function logoutAction(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  return { success: true };
}
