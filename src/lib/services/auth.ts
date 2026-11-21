import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { validate } from "@/lib/security/validate";
import { loginSchema, type LoginInput } from "@/lib/contracts";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { recordAuditEvent } from "@/lib/security/audit";
import type { SessionCookieSubject } from "@/lib/auth/cookies";

/** Result payload returned from an authentication sign-in attempt. */
export type AuthResponse =
  | { success: true; user: { id: string; email: string; role: string } }
  | { success: false; error?: string; errors?: Record<string, string[]> };

export async function authenticateWithPasswordService(
  formData: Partial<LoginInput>,
  clientIp: string
): Promise<{ response: AuthResponse; session?: SessionCookieSubject }> {
  const candidateEmail = typeof formData.email === "string" ? formData.email.toLowerCase().trim() : "";
  const rate = checkRateLimit(`login:${clientIp}:${candidateEmail}`, RATE_LIMITS.auth);
  if (!rate.allowed) {
    return {
      response: { success: false, error: `Too many login attempts. Please retry in ${rate.retryAfter} seconds.` },
    };
  }

  const validation = validate(loginSchema, formData);
  if (!validation.success) {
    return { response: { success: false, errors: validation.errors } };
  }

  const { email, password } = validation.data;
  const cleanEmail = email.toLowerCase().trim();
  const db = getDb();
  const user = db.select().from(users).where(eq(users.email, cleanEmail)).get();

  if (!user) {
    recordAuditEvent({
      actorEmail: cleanEmail,
      action: "auth.login",
      targetType: "user",
      status: "failure",
      ipAddress: clientIp,
      metadata: { reason: "unknown_email" },
    });
    return { response: { success: false, error: "Invalid email or password" } };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      siteId: user.siteId,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      status: "failure",
      ipAddress: clientIp,
      metadata: { reason: "invalid_password" },
    });
    return { response: { success: false, error: "Invalid email or password" } };
  }

  recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    siteId: user.siteId,
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    status: "success",
    ipAddress: clientIp,
  });

  return {
    response: { success: true, user: { id: user.id, email: user.email, role: user.role } },
    session: {
      userId: user.id,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      tokenVersion: user.tokenVersion,
    },
  };
}
