import { cookies } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getCurrentUser(): Promise<(TokenPayload & { exists: boolean }) | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
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
