import { NextRequest, NextResponse } from "next/server";
import { publishScheduledPosts } from "@/lib/db/scheduled";
import { authorizeCronRequest } from "@/lib/cron/auth";
import { revalidatePostPaths } from "@/lib/cache/revalidate";
import { getRequestId } from "@/lib/http/request";
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
  const route = "/api/cron/publish";
  const unauthorized = await authorizeCronRequest(req, route);
  if (unauthorized) return unauthorized;

  const requestId = getRequestId(req.headers);
  const startedAt = Date.now();
  const siteId = req.nextUrl.searchParams.get("siteId") || undefined;

  try {
    const result = await publishScheduledPosts(siteId);

    if (result.publishedPostsCount > 0 || result.publishedPagesCount > 0) {
      revalidatePostPaths(null, null, siteId);
    }

    logEvent("info", "cron.publish.completed", {
      route,
      requestId,
      siteId,
      durationMs: Date.now() - startedAt,
      publishedPostsCount: result.publishedPostsCount,
      publishedPagesCount: result.publishedPagesCount,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logError("cron.publish.failed", error, {
      route,
      requestId,
      siteId,
      durationMs: Date.now() - startedAt,
    });
    void notifyCriticalAlert("cron.publish.failed", { requestId, siteId });
    return NextResponse.json({ error: "Scheduled publish run failed" }, { status: 500 });
  }
}
