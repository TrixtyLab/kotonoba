import { NextRequest, NextResponse } from "next/server";
import { issueSessionCookies } from "@/lib/auth/cookies";
import { getClientIp, isSameOriginRequest } from "@/lib/http/request";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { completeSetupWizardService, type SetupWizardData } from "@/lib/services/setup";
import { hasAdminUser } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Handles atomic first-time setup provisioning without triggering RSC route revalidation on `/setup`,
 * allowing Step 5 confirmation UI to render before subsequent visits lock out to `/login`.
 *
 * @param request - Incoming `NextRequest` carrying the setup configuration payload.
 * @returns JSON response with provisioned `siteId` / `userId` and session cookies, or error status.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ success: false, error: "Forbidden cross-origin request." }, { status: 403 });
  }

  const clientIp = getClientIp(request.headers);
  const rl = checkRateLimit(`setup:${clientIp}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Too many setup attempts." }, { status: 429 });
  }

  if (hasAdminUser()) {
    return NextResponse.json({ success: false, error: "System is already initialized." }, { status: 403 });
  }

  let body: SetupWizardData;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ success: false, error: "Invalid request payload." }, { status: 400 });
    }
    body = parsed as SetupWizardData;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const res = await completeSetupWizardService(body);
  if (!res.success) {
    const status = res.error === "System is already initialized." ? 403 : 400;
    return NextResponse.json({ success: false, error: res.error }, { status });
  }

  await issueSessionCookies(res.session);
  return NextResponse.json({
    success: true,
    siteId: res.siteId,
    userId: res.userId,
  });
}
