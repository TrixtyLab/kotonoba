import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";
import crypto from "crypto";

const BOT_USER_AGENTS = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptimerobot|preview|google-read-aloud/i;

/**
 * Analytics beacon endpoint ingesting genuine pageviews while filtering automated bots, platform administrators, post authors, and duplicate visits within a 15-minute deduplication window.
 *
 * @param {NextRequest} req - Incoming beacon payload containing siteId, optional postId, path, and UTM campaign parameters.
 * @returns {Promise<NextResponse>} JSON response indicating whether the pageview was recorded, ignored, or rejected.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get("x-purpose") === "preview" || req.headers.get("sec-purpose") === "prefetch") {
    return NextResponse.json({ success: true, ignored: "prefetch" });
  }

  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : "127.0.0.1";
  const rate = checkRateLimit(ip, RATE_LIMITS.analytics);

  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const userAgent = req.headers.get("user-agent") || "";

    if (!userAgent || BOT_USER_AGENTS.test(userAgent)) {
      return NextResponse.json({ success: true, ignored: "bot" });
    }

    const body = await req.json();
    const {
      siteId,
      postId,
      path,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
    } = body;

    if (!siteId || !path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();

    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        if (currentUser.role === "super_admin") {
          return NextResponse.json({ success: true, ignored: "super_admin" });
        }

        if (postId) {
          const post = db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).get();
          if (post && post.authorId === currentUser.userId) {
            return NextResponse.json({ success: true, ignored: "post_author" });
          }
        }
      }
    } catch {
      // Session retrieval failed — treat as anonymous visitor and continue recording
    }

    const ipHash = crypto.createHash("sha256").update(`${ip}-${userAgent}`).digest("hex").slice(0, 16);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const recentVisit = db
      .select({ id: analytics.id })
      .from(analytics)
      .where(
        and(
          eq(analytics.siteId, siteId),
          eq(analytics.path, path),
          eq(analytics.ipHash, ipHash),
          gt(analytics.createdAt, fifteenMinutesAgo)
        )
      )
      .get();

    if (recentVisit) {
      return NextResponse.json({ success: true, ignored: "duplicate_window" });
    }

    const referrer = req.headers.get("referer") || undefined;
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || undefined;
    const { device, browser } = parseDeviceAndBrowser(userAgent);

    db.insert(analytics)
      .values({
        siteId,
        postId: postId || null,
        path,
        referrer: referrer ? referrer.slice(0, 500) : undefined,
        userAgent: userAgent.slice(0, 500),
        country,
        device,
        browser,
        utmSource: utm_source ? String(utm_source).slice(0, 100) : undefined,
        utmMedium: utm_medium ? String(utm_medium).slice(0, 100) : undefined,
        utmCampaign: utm_campaign ? String(utm_campaign).slice(0, 100) : undefined,
        utmTerm: utm_term ? String(utm_term).slice(0, 100) : undefined,
        utmContent: utm_content ? String(utm_content).slice(0, 100) : undefined,
        ipHash,
        createdAt: new Date(),
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
