import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics, posts, pages } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";
import { verifyToken } from "@/lib/auth/jwt";
import crypto from "crypto";

const BOT_USER_AGENTS = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptimerobot|preview|google-read-aloud/i;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Handles GET health probe checks on the analytics endpoint.
 *
 * @returns {Promise<NextResponse>} Simple JSON probe confirmation.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok", endpoint: "/api/analytics/hit" });
}

/**
 * Handles CORS preflight requests on the analytics endpoint.
 *
 * @returns {Promise<NextResponse>} Response with allowed methods.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, GET, OPTIONS",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Analytics beacon endpoint ingesting genuine pageviews while filtering automated bots,
 * logged-in administrators/authors, and duplicate visits within a 15-minute deduplication window.
 *
 * @param {NextRequest} req - Incoming beacon payload containing siteId, optional postId or pageId, path, and UTM campaign parameters.
 * @returns {Promise<NextResponse>} JSON response indicating whether the pageview was recorded, ignored, or rejected.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get("x-purpose") === "preview" || req.headers.get("sec-purpose") === "prefetch") {
    return NextResponse.json({ success: true, ignored: "prefetch" });
  }

  // Filter out authenticated dashboard users (super_admin, admin, author) from recording their own visits
  const accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload?.userId) {
      return NextResponse.json({ success: true, ignored: "logged_in_user" });
    }
  }
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload?.userId) {
      return NextResponse.json({ success: true, ignored: "logged_in_user" });
    }
  }

  const rawIp =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  const ip = rawIp.length > 0 ? rawIp : "0.0.0.0";
  const rateLimitKey = `analytics:${ip}`;
  const rate = checkRateLimit(rateLimitKey, RATE_LIMITS.analytics);

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
      pageId,
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
    let resolvedPostId: string | null = postId || null;
    let resolvedPageId: string | null = pageId || null;

    if (!resolvedPostId && !resolvedPageId) {
      const entryMatch = String(path).match(/(?:^|\/)entry\/([^/?#]+)/);
      if (entryMatch) {
        const postSlug = decodeURIComponent(entryMatch[1]);
        const post = db
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.siteId, siteId), eq(posts.slug, postSlug)))
          .get();
        if (post) {
          resolvedPostId = post.id;
        }
      }

      const pageMatch = String(path).match(/(?:^|\/)p\/([^/?#]+)/);
      if (pageMatch) {
        const pageSlug = decodeURIComponent(pageMatch[1]);
        const page = db
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.siteId, siteId), eq(pages.slug, pageSlug)))
          .get();
        if (page) {
          resolvedPageId = page.id;
        }
      }
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
        postId: resolvedPostId,
        pageId: resolvedPageId,
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

    if (resolvedPostId) {
      db.update(posts)
        .set({ views: sql`${posts.views} + 1` })
        .where(eq(posts.id, resolvedPostId))
        .run();
    }

    if (resolvedPageId) {
      db.update(pages)
        .set({ views: sql`${pages.views} + 1` })
        .where(eq(pages.id, resolvedPageId))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[analytics/hit] Error recording pageview:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
