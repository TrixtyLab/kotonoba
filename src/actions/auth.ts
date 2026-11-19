"use server";

import { headers } from "next/headers";
import { clearSessionCookies, issueSessionCookies } from "@/lib/auth/cookies";
import { getClientIp } from "@/lib/http/request";
import type { LoginInput } from "@/lib/security/validate";
import {
  authenticateWithPasswordService,
  type AuthResponse,
} from "@/lib/services/auth";

export type { AuthResponse };

/** Authenticates user credentials under rate limiting and sets `httpOnly` session cookies. */
export async function loginAction(formData: Partial<LoginInput>): Promise<AuthResponse> {
  const reqHeaders = await headers();
  const clientIp = getClientIp(reqHeaders);
  const { response, session } = await authenticateWithPasswordService(formData, clientIp);

  if (response.success && session) {
    await issueSessionCookies(session);
  }
  return response;
}

/** Clears session and refresh cookies to terminate the user session. */
export async function logoutAction(): Promise<{ success: true }> {
  await clearSessionCookies();
  return { success: true };
}
