import { cookies } from "next/headers";
import { verifyToken, signAccessToken, getSessionDuration, type TokenPayload } from "./jwt";
import { getDb } from "@/lib/db";
import { isProductionEnv } from "@/lib/config/env";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function renewUserFromRefreshToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  refreshToken: string
): Promise<(TokenPayload & { exists: boolean }) | null> {
  const refreshPayload = await verifyToken(refreshToken);
  if (!refreshPayload?.userId) return null;

  try {
    const db = getDb();
    const user = db.select().from(users).where(eq(users.id, refreshPayload.userId)).get();
    if (!user || (refreshPayload.tokenVersion ?? 1) !== user.tokenVersion) return null;

    const { maxAgeSeconds } = getSessionDuration();
    const newAccessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      tokenVersion: user.tokenVersion,
    });

    cookieStore.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: isProductionEnv(),
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      tokenVersion: user.tokenVersion,
      exists: true,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user from incoming request cookies.
 * Automatically performs silent token renewal if the access token is expired but a valid refresh token exists.
 *
 * @returns A Promise resolving to the validated TokenPayload with existence flag, or null if unauthenticated.
 */
export async function getCurrentUser(): Promise<(TokenPayload & { exists: boolean }) | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  const payload = accessToken ? await verifyToken(accessToken) : null;
  if (!payload && refreshToken) {
    const renewed = await renewUserFromRefreshToken(cookieStore, refreshToken);
    if (renewed) return renewed;
  }

  if (!payload?.userId) return null;

  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, payload.userId)).get();
  if (!user || (payload.tokenVersion ?? 1) !== user.tokenVersion) {
    return { ...payload, exists: false };
  }

  return {
    ...payload,
    role: user.role,
    siteId: user.siteId,
    tokenVersion: user.tokenVersion,
    exists: true,
  };
}

/**
 * Enforces session authentication and optional role authorization within Server Actions or API routes.
 *
 * @param allowedRoles - Optional array of authorized role identifiers. If omitted, any authenticated role is permitted.
 * @returns A Promise resolving to the authenticated user's TokenPayload.
 * @throws {Error} Throws 'UNAUTHORIZED' when no active session exists, or 'FORBIDDEN' when the user role is unauthorized.
 */
export async function requireAuth(allowedRoles?: string[]): Promise<TokenPayload> {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    throw new Error("UNAUTHORIZED");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
