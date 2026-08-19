import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Liveness and readiness health probe verifying database connectivity and reporting server uptime.
 *
 * @returns JSON health report status.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const result = db.get<{ ok: number }>(sql`SELECT 1 as ok`);

    if (!result || result.ok !== 1) {
      return NextResponse.json(
        { status: "unhealthy", reason: "Database ping failed" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      db: "connected",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failure";
    return NextResponse.json(
      { status: "unhealthy", error: message },
      { status: 503 }
    );
  }
}
