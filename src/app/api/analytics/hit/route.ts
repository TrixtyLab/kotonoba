import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";
import crypto from "crypto";

const BOT_USER_AGENTS = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptimerobot|preview|google-read-aloud/i;

/**
 * Extracts device category (mobile, tablet, desktop) and browser vendor from a User-Agent string.
 *
 * @param userAgent - Raw client User-Agent string.
 * @returns Object with normalized device and browser identifiers.
 */
function parseDeviceAndBrowser(userAgent: string): { device: string; browser: string } {
  const ua = userAgent.toLowerCase();
  
  let device = "desktop";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    device = "mobile";
  } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
    device = "tablet";
  }

  let browser = "Other";
  if (ua.includes("edg/")) {
    browser = "Edge";
  } else if (ua.includes("chrome") && !ua.includes("chromium")) {
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("opera") || ua.includes("opr/")) {
    browser = "Opera";
  }

  return { device, browser };
}

/**
 * Analytics beacon endpoint ingesting genuine pageviews while filtering automated bots, author views, and duplicate visits.
 *
 * @param req - The incoming NextRequest beacon payload.
 * @returns NextResponse with recording status.
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
        if (currentUser.role === "super_admin" || currentUser.siteId === siteId) {
          return NextResponse.json({ success: true, ignored: "author_or_admin" });
        }

        if (postId) {
          const post = db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).get();
          if (post && post.authorId === currentUser.userId) {
            return NextResponse.json({ success: true, ignored: "post_author" });
          }
        }
      }
    } catch {}

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
