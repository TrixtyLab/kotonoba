import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEnvConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { getClientIp, getRequestId } from "@/lib/http/request";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { collectOperationalMetrics } from "@/lib/observability/metrics";
import { logError } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Constant-time comparison for bearer secrets.
 *
 * @param expected - Configured secret.
 * @param actual - Presented token.
 * @returns `true` when both values match exactly.
 */
function timingSafeMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  const ip = getClientIp(req.headers);
  const rate = checkRateLimit(`metrics:${ip}`, RATE_LIMITS.default);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfter / 1000)) } }
    );
  }

  let authorized = Boolean(cronSecret && token && timingSafeMatches(cronSecret, token));
  if (!authorized) {
    const user = await getCurrentUser();
    authorized = Boolean(user?.exists && user.role === "super_admin");
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
