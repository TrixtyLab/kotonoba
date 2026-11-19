import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { analytics, sites } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { getSiteForHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const heartbeatSchema = z.object({
  siteId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(64),
  path: z.string().min(1).max(500),
  timeOnPage: z.number().finite().positive().max(86400),
});

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
  const clientIp = getClientIp(req.headers);
  const rateLimitKey = `analytics:heartbeat:${clientIp}`;
  const rate = checkRateLimit(rateLimitKey, RATE_LIMITS.analytics);

  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    let rawBody: unknown;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      rawBody = await req.json();
    } else {
      const textBody = await req.text();
      rawBody = JSON.parse(textBody);
    }

    const parsed = heartbeatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid heartbeat payload" }, { status: 400 });
    }

    const { siteId, sessionId, path, timeOnPage } = parsed.data;

    const hostSite = await getSiteForHost();
    if (hostSite && hostSite.id !== siteId) {
      return NextResponse.json({ error: "Site mismatch for request host" }, { status: 403 });
    }

    const db = getDb();
    const targetSite = hostSite || db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
    if (!targetSite) {
      return NextResponse.json({ error: "Unknown site" }, { status: 404 });
    }

    const clampedDuration = Math.min(Math.round(timeOnPage), 7200);

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
