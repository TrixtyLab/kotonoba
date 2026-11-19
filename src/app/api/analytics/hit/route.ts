import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { analytics, posts, pages, sites } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { getSiteForHost } from "@/lib/tenant";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";
import { verifyToken } from "@/lib/auth/jwt";
import crypto from "crypto";

const BOT_USER_AGENTS = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptimerobot|preview|google-read-aloud/i;

const hitPayloadSchema = z.object({
  siteId: z.string().min(1).max(128),
  postId: z.string().min(1).max(128).optional().nullable(),
  pageId: z.string().min(1).max(128).optional().nullable(),
  path: z.string().min(1).max(500),
  utm_source: z.string().max(100).optional().nullable(),
  utm_medium: z.string().max(100).optional().nullable(),
  utm_campaign: z.string().max(100).optional().nullable(),
  utm_term: z.string().max(100).optional().nullable(),
  utm_content: z.string().max(100).optional().nullable(),
  language: z.string().max(20).optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
  loadTime: z.number().finite().positive().max(120000).optional().nullable(),
  screenWidth: z.number().int().positive().max(10000).optional().nullable(),
  screenHeight: z.number().int().positive().max(10000).optional().nullable(),
});

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
 * Analytics beacon endpoint ingesting genuine pageviews while enforcing host/tenant
 * ownership checks, bot filtering, authenticated-staff exclusion, and 15-minute IP deduplication.
 *
 * @param {NextRequest} req - Incoming beacon payload.
 * @returns {Promise<NextResponse>} JSON response indicating outcome.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get("x-purpose") === "preview" || req.headers.get("sec-purpose") === "prefetch") {
    return NextResponse.json({ success: true, ignored: "prefetch" });
  }

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

  const ip = getClientIp(req.headers);
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

    const rawBody = await req.json();
    const parsed = hitPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid beacon payload" }, { status: 400 });
    }

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
      language: rawLanguage,
      sessionId: rawSessionId,
      loadTime: rawLoadTime,
      screenWidth: rawScreenWidth,
      screenHeight: rawScreenHeight,
    } = parsed.data;

    const db = getDb();
    const hostSite = await getSiteForHost();
    if (hostSite && hostSite.id !== siteId) {
      return NextResponse.json({ error: "Site mismatch for request host" }, { status: 403 });
    }

    const targetSite = hostSite || db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
    if (!targetSite) {
      return NextResponse.json({ error: "Unknown site" }, { status: 404 });
    }

    let resolvedPostId: string | null = null;
    let resolvedPageId: string | null = null;

    if (postId) {
      const ownedPost = db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.siteId, siteId)))
        .get();
      if (!ownedPost) {
        return NextResponse.json({ error: "Post does not belong to site" }, { status: 400 });
      }
      resolvedPostId = ownedPost.id;
    }

    if (pageId) {
      const ownedPage = db
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
        .get();
      if (!ownedPage) {
        return NextResponse.json({ error: "Page does not belong to site" }, { status: 400 });
      }
      resolvedPageId = ownedPage.id;
    }

    if (!resolvedPostId && !resolvedPageId) {
      const entryMatch = path.match(/(?:^|\/)entry\/([^/?#]+)/);
      if (entryMatch) {
        let postSlug = entryMatch[1];
        try {
          postSlug = decodeURIComponent(postSlug);
        } catch {}
        const post = db
          .select({ id: posts.id })
          .from(posts)
          .where(and(eq(posts.siteId, siteId), eq(posts.slug, postSlug)))
          .get();
        if (post) resolvedPostId = post.id;
      }

      const pageMatch = path.match(/(?:^|\/)p\/([^/?#]+)/);
      if (pageMatch) {
        let pageSlug = pageMatch[1];
        try {
          pageSlug = decodeURIComponent(pageSlug);
        } catch {}
        const page = db
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.siteId, siteId), eq(pages.slug, pageSlug)))
          .get();
        if (page) resolvedPageId = page.id;
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
    const { device, browser, os } = parseDeviceAndBrowser(userAgent);
    const headerLang = req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim();
    const language = (rawLanguage?.trim() || headerLang || "").slice(0, 20);
    const sessionId = (rawSessionId || "").slice(0, 64);
    const loadTime = typeof rawLoadTime === "number" ? Math.round(rawLoadTime) : undefined;
    const screenWidth = typeof rawScreenWidth === "number" ? Math.round(rawScreenWidth) : undefined;
    const screenHeight = typeof rawScreenHeight === "number" ? Math.round(rawScreenHeight) : undefined;

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
        os,
        language,
        sessionId,
        loadTime,
        screenWidth,
        screenHeight,
        utmSource: utm_source ? utm_source.slice(0, 100) : undefined,
        utmMedium: utm_medium ? utm_medium.slice(0, 100) : undefined,
        utmCampaign: utm_campaign ? utm_campaign.slice(0, 100) : undefined,
        utmTerm: utm_term ? utm_term.slice(0, 100) : undefined,
        utmContent: utm_content ? utm_content.slice(0, 100) : undefined,
        ipHash,
        createdAt: new Date(),
      })
      .run();

    if (resolvedPostId) {
      db.update(posts)
        .set({ views: sql`${posts.views} + 1` })
        .where(and(eq(posts.id, resolvedPostId), eq(posts.siteId, siteId)))
        .run();
    }

    if (resolvedPageId) {
      db.update(pages)
        .set({ views: sql`${pages.views} + 1` })
        .where(and(eq(pages.id, resolvedPageId), eq(pages.siteId, siteId)))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[analytics/hit] Error recording pageview:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
