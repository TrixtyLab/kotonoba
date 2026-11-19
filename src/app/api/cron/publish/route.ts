import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEnvConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { publishScheduledPosts } from "@/lib/db/scheduled";
import { aggregateDailyAnalytics, pruneExpiredAnalytics } from "@/lib/analytics/retention";
import { revalidatePostPaths } from "@/lib/cache/revalidate";

export const dynamic = "force-dynamic";

function timingSafeMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Protected cron endpoint transitioning scheduled posts/pages whose publish timestamp has passed
 * and processing pending Discord/Bluesky outbox notification deliveries.
 *
 * Authenticates via `Authorization: Bearer <CRON_SECRET>` or an active `super_admin` session.
 *
 * @param req - Incoming `NextRequest`.
 * @returns JSON summary of published items and delivered notifications.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { cronSecret, nodeEnv } = getEnvConfig();
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  let authorized = false;

  if (cronSecret && token && timingSafeMatches(cronSecret, token)) {
    authorized = true;
  } else {
    const user = await getCurrentUser();
    if (user?.exists && user.role === "super_admin") {
      authorized = true;
    }
  }

  if (!authorized) {
    if (!cronSecret && nodeEnv === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured in production." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get("siteId") || undefined;
  const result = await publishScheduledPosts(siteId);
  const aggregatedDailyCount = aggregateDailyAnalytics({ siteId });
  const prunedAnalyticsCount = pruneExpiredAnalytics();

  if (result.publishedPostsCount > 0 || result.publishedPagesCount > 0) {
    revalidatePostPaths();
  }

  return NextResponse.json({
    success: true,
    ...result,
    aggregatedDailyCount,
    prunedAnalyticsCount,
  });
}
