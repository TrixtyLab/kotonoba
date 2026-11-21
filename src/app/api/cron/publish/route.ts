import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/config/constants";
import { getEnvConfig } from "@/lib/config/env";
import { isAnalyticsPruningEnabled } from "@/lib/config/features";
import { getCurrentUser } from "@/lib/auth/session";
import { publishScheduledPosts } from "@/lib/db/scheduled";
import { aggregateDailyAnalytics, pruneExpiredAnalytics } from "@/lib/analytics/retention";
import { revalidatePostPaths } from "@/lib/cache/revalidate";
import { getRequestId, verifyBearerSecret } from "@/lib/http/request";
import { logError, logEvent } from "@/lib/observability/logger";
import { notifyCriticalAlert } from "@/lib/observability/alerts";

export const dynamic = "force-dynamic";

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
  const requestId = getRequestId(req.headers);

  let authorized = verifyBearerSecret(req.headers, cronSecret);
  if (!authorized) {
    const user = await getCurrentUser();
    if (user?.exists && user.role === ROLES.SUPER_ADMIN) {
      authorized = true;
    }
  }

  if (!authorized) {
    if (!cronSecret && nodeEnv === "production") {
      logEvent("error", "cron.publish.unconfigured", { route: "/api/cron/publish", requestId });
      return NextResponse.json(
        { error: "CRON_SECRET is not configured in production." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const siteId = req.nextUrl.searchParams.get("siteId") || undefined;

  try {
    const result = await publishScheduledPosts(siteId);
    const aggregatedDailyCount = aggregateDailyAnalytics({ siteId });
    const prunedAnalyticsCount = isAnalyticsPruningEnabled() ? pruneExpiredAnalytics() : 0;

    if (result.publishedPostsCount > 0 || result.publishedPagesCount > 0) {
      revalidatePostPaths(null, null, siteId);
    }

    logEvent("info", "cron.publish.completed", {
      route: "/api/cron/publish",
      requestId,
      siteId,
      durationMs: Date.now() - startedAt,
      publishedPostsCount: result.publishedPostsCount,
      publishedPagesCount: result.publishedPagesCount,
      aggregatedDailyCount,
      prunedAnalyticsCount,
    });

    return NextResponse.json({
      success: true,
      ...result,
      aggregatedDailyCount,
      prunedAnalyticsCount,
    });
  } catch (error) {
    logError("cron.publish.failed", error, {
      route: "/api/cron/publish",
      requestId,
      siteId,
      durationMs: Date.now() - startedAt,
    });
    void notifyCriticalAlert("cron.publish.failed", { requestId, siteId });
    return NextResponse.json({ error: "Scheduled publish run failed" }, { status: 500 });
  }
}
