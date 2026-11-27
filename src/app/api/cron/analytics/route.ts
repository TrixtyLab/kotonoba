import { NextRequest, NextResponse } from "next/server";
import { isAnalyticsPruningEnabled } from "@/lib/config/features";
import { aggregateDailyAnalytics, pruneExpiredAnalytics } from "@/lib/analytics/retention";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { getRequestId } from "@/lib/http/request";
import { logError, logEvent } from "@/lib/observability/logger";
import { notifyCriticalAlert } from "@/lib/observability/alerts";

export const dynamic = "force-dynamic";

/**
 * Daily analytics maintenance endpoint: rolls raw hits into `analytics_daily`
 * and prunes rows older than `ANALYTICS_RETENTION_DAYS`.
 *
 * Kept separate from `/api/cron/publish` so a 60-second publishing cadence does
 * not re-aggregate the whole analytics table on every tick.
 *
 * @param req - Incoming cron request.
 * @returns JSON summary with aggregated and pruned row counts.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const route = "/api/cron/analytics";
  const unauthorized = await authorizeCronRequest(req, route);
  if (unauthorized) return unauthorized;

  const requestId = getRequestId(req.headers);
  const startedAt = Date.now();

  try {
    const aggregatedDailyCount = aggregateDailyAnalytics();
    const prunedAnalyticsCount = isAnalyticsPruningEnabled() ? pruneExpiredAnalytics() : 0;

    logEvent("info", "cron.analytics.completed", {
      route,
      requestId,
      durationMs: Date.now() - startedAt,
      aggregatedDailyCount,
      prunedAnalyticsCount,
    });

    return NextResponse.json({ success: true, aggregatedDailyCount, prunedAnalyticsCount });
  } catch (error) {
    logError("cron.analytics.failed", error, {
      route,
      requestId,
      durationMs: Date.now() - startedAt,
    });
    void notifyCriticalAlert("cron.analytics.failed", { requestId });
    return NextResponse.json({ error: "Analytics maintenance run failed" }, { status: 500 });
  }
}
