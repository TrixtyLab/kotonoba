import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness health probe verifying database connectivity.
 * Omits version metadata and internal stack messages to avoid passive fingerprinting.
 *
 * @returns JSON health report status.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const result = db.get<{ ok: number }>(sql`SELECT 1 as ok`);

    if (!result || result.ok !== 1) {
      return NextResponse.json(
        { status: "unhealthy", db: "disconnected" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[health] Readiness probe failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { status: "unhealthy", db: "error" },
      { status: 503 }
    );
  }
}
