import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * Lightweight privacy-friendly analytics beacon endpoint.
 * Ingests pageviews without persistent tracking cookies.
 */
export async function POST(req: NextRequest) {
  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : "127.0.0.1";
  const rate = checkRateLimit(ip, RATE_LIMITS.analytics);

  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { siteId, postId, path } = body;

    if (!siteId || !path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const referrer = req.headers.get("referer") || undefined;
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || undefined;

    const db = getDb();
    db.insert(analytics)
      .values({
        siteId,
        postId: postId || null,
        path,
        referrer,
        userAgent: userAgent ? userAgent.slice(0, 500) : undefined,
        country,
        timestamp: new Date(),
      })
      .run();

    if (postId) {
      db.update(posts)
        .set({ views: sql`${posts.views} + 1` })
        .where(eq(posts.id, postId))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
