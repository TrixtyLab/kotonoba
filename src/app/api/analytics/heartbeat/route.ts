import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getClientIp } from "@/lib/http/request";
import {
  checkAnalyticsIpRateLimit,
  checkAnalyticsSiteRateLimit,
  resolveAnalyticsSite,
} from "@/lib/analytics/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const heartbeatSchema = z.object({
  siteId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(64),
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
      message: "Path must be an absolute same-origin path",
    }),
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
  const ipRate = checkAnalyticsIpRateLimit("heartbeat", clientIp);
  if (!ipRate.allowed) {
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

    const { siteId: requestedSiteId, sessionId, path, timeOnPage } = parsed.data;

    const resolution = await resolveAnalyticsSite(requestedSiteId);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.error }, { status: resolution.status });
    }

    const siteId = resolution.siteId;
    const siteRate = checkAnalyticsSiteRateLimit("heartbeat", clientIp, siteId);
    if (!siteRate.allowed) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const db = getDb();
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
