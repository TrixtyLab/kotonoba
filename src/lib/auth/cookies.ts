import { cookies } from "next/headers";
import { getRefreshDuration, getSessionDuration, signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { isProductionEnv } from "@/lib/config/env";

/** Minimal identity claim payload needed to mint session + refresh cookies. */
export interface SessionCookieSubject {
  userId: string;
  email: string;
  role: string;
  siteId: string | null;
  tokenVersion: number;
}

/**
 * Signs access + refresh JWTs and writes strict `httpOnly`, `sameSite=lax` session cookies.
 *
 * @param subject - Authenticated user session claims.
 */
export async function issueSessionCookies(subject: SessionCookieSubject): Promise<void> {
  const accessToken = await signAccessToken({
    userId: subject.userId,
    email: subject.email,
    role: subject.role,
    siteId: subject.siteId,
    tokenVersion: subject.tokenVersion,
  });
  const refreshToken = await signRefreshToken(subject.userId, subject.tokenVersion);

  const { maxAgeSeconds: sessionMaxAge } = getSessionDuration();
  const { maxAgeSeconds: refreshMaxAge } = getRefreshDuration();

  const cookieStore = await cookies();
  const secure = isProductionEnv();

  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

/**
 * Clears session cookies on logout.
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
}
