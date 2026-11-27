import { NextRequest, NextResponse } from "next/server";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { ROLE_ALL } from "@/lib/auth/roles";
import { getRealtimeFeedData } from "@/lib/analytics/realtime";

/**
 * HTTP GET endpoint returning live telemetry metrics (active concurrent users, recent hits, active pages).
 * Enforces site-level authorization before returning live tenant analytics.
 *
 * @param {NextRequest} request - Incoming request object containing siteId query parameter.
 * @returns {Promise<NextResponse>} JSON response containing RealtimeDataResponse.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");

    if (!siteId || typeof siteId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid site ID" },
        { status: 400 }
      );
    }

    await requireSiteAccess(siteId, ROLE_ALL);

    const data = await getRealtimeFeedData(siteId);

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unauthorized";
    const status = errorMsg === "UNAUTHORIZED" ? 401 : errorMsg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ success: false, error: errorMsg }, { status });
  }
}
