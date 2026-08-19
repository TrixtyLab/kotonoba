import { cookies } from "next/headers";
import { verifyToken, signAccessToken, getSessionDuration, type TokenPayload } from "./jwt";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  let payload: TokenPayload | null = null;
  if (accessToken) {
    payload = await verifyToken(accessToken);
  }

  if (!payload && refreshToken) {
    const refreshPayload = await verifyToken(refreshToken);
    if (refreshPayload?.userId) {
      try {
        const db = getDb();
        const user = db.select().from(users).where(eq(users.id, refreshPayload.userId)).get();
        if (user) {
          const { maxAgeSeconds } = getSessionDuration();
          const newAccessToken = await signAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            siteId: user.siteId,
          });

          cookieStore.set("access_token", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: maxAgeSeconds,
          });

          return {
            userId: user.id,
            email: user.email,
            role: user.role,
            siteId: user.siteId,
            exists: true,
          };
        }
      } catch {
        // Fall through on database retrieval failure
      }
    }
  }

  if (!payload?.userId) return null;

  const db = getDb();
  const user = db.select().from(users).where(eq(users.id, payload.userId)).get();

  if (!user) return { ...payload, exists: false };

  return {
    ...payload,
    role: user.role,
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
