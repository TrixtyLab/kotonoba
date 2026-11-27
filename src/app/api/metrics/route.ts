import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/config/constants";
import { getEnvConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { getClientIp, getRequestId, verifyBearerSecret } from "@/lib/http/request";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { collectOperationalMetrics } from "@/lib/observability/metrics";
import { logError } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Protected operational metrics endpoint for dashboards and alerting.
 *
 * Accepts `Authorization: Bearer <CRON_SECRET>` or an authenticated `super_admin`
 * session. The payload contains process and database counters only; it never
 * returns tenant content, credentials, or visitor identifiers.
 *
 * @param req - Incoming `NextRequest`.
 * @returns JSON metrics snapshot, or an authentication/error response.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { cronSecret } = getEnvConfig();

  const ip = getClientIp(req.headers);
  const rate = checkRateLimit(`metrics:${ip}`, RATE_LIMITS.default);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfter / 1000)) } }
    );
  }

  let authorized = verifyBearerSecret(req.headers, cronSecret);
  if (!authorized) {
    const user = await getCurrentUser();
    authorized = Boolean(user?.exists && user.role === ROLES.SUPER_ADMIN);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const metrics = await collectOperationalMetrics();
    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logError("metrics.collect.failed", error, {
      route: "/api/metrics",
      requestId: getRequestId(req.headers),
    });
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 503 });
  }
}
