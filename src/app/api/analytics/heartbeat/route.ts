import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Handles CORS preflight requests on the analytics heartbeat endpoint.
 *
 * @returns {Promise<NextResponse>} Response containing allowed HTTP methods and headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Updates cumulative engagement duration (time-on-page) for an ongoing visitor session.
 *
 * @param {NextRequest} req - Incoming request payload with siteId, sessionId, path, and elapsed seconds.
 * @returns {Promise<NextResponse>} JSON response confirming update outcome or reporting validation errors.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawIp =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0";
  const rateLimitKey = `analytics:heartbeat:${rawIp}`;
  const rate = checkRateLimit(rateLimitKey, RATE_LIMITS.analytics);

  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    let body: { siteId?: string; sessionId?: string; path?: string; timeOnPage?: number };
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const textBody = await req.text();
      body = JSON.parse(textBody);
    }

    const { siteId, sessionId, path, timeOnPage } = body;

    if (!siteId || !sessionId || !path || typeof timeOnPage !== "number" || isNaN(timeOnPage) || timeOnPage <= 0) {
      return NextResponse.json({ error: "Invalid heartbeat payload" }, { status: 400 });
    }

    const clampedDuration = Math.min(Math.round(timeOnPage), 7200);

    const db = getDb();
    const existingRecord = db
      .select({ id: analytics.id, currentTime: analytics.timeOnPage })
      .from(analytics)
      .where(
        and(
          eq(analytics.siteId, siteId),
          eq(analytics.sessionId, sessionId),
          eq(analytics.path, path)
        )
      )
      .orderBy(desc(analytics.createdAt))
      .limit(1)
      .get();

    if (existingRecord) {
      const updatedSeconds = Math.max(existingRecord.currentTime || 0, clampedDuration);
      db.update(analytics)
        .set({ timeOnPage: updatedSeconds })
        .where(eq(analytics.id, existingRecord.id))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[analytics/heartbeat] Error recording heartbeat:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
