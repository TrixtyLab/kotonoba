import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getRealtimeFeedData } from "@/lib/analytics/realtime";

/**
 * HTTP GET endpoint returning live telemetry metrics (active concurrent users, recent hits, active pages).
 * Designed for low-latency client-side polling with no reliance on ephemeral Server Action IDs.
 *
 * @param {NextRequest} request - Incoming request object containing siteId query parameter.
 * @returns {Promise<NextResponse>} JSON response containing RealtimeDataResponse.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(["super_admin", "admin", "editor", "author"]);

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");

    if (!siteId || typeof siteId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid site ID" },
        { status: 400 }
      );
    }

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
