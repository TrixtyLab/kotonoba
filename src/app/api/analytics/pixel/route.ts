import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const BOT_USER_AGENTS = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptimerobot|preview|google-read-aloud/i;

/**
 * Serves a 1x1 transparent tracking GIF while recording campaign impression telemetry.
 *
 * @param {NextRequest} req - Inbound HTTP request containing query parameters `sid` (siteId) and optional `src` (campaign tag).
 * @returns {Promise<NextResponse>} 1x1 GIF binary response with non-caching HTTP headers.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gifResponse = new NextResponse(TRANSPARENT_GIF_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF_BUFFER.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("sid")?.trim();
  const campaignSource = searchParams.get("src")?.trim() || "newsletter";

  if (!siteId) {
    return gifResponse;
  }

  const rawIp =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0";
  const rateLimitKey = `analytics:pixel:${rawIp}`;
  const rate = checkRateLimit(rateLimitKey, RATE_LIMITS.analytics);

  if (!rate.allowed) {
    return gifResponse;
  }

  const userAgent = req.headers.get("user-agent") || "";
  if (BOT_USER_AGENTS.test(userAgent)) {
    return gifResponse;
  }

  try {
    const db = getDb();
    const siteExists = db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).get();
    if (!siteExists) {
      return gifResponse;
    }

    const ipHash = crypto.createHash("sha256").update(`${rawIp}-${userAgent}`).digest("hex").slice(0, 16);
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || undefined;
    const { device, browser, os } = parseDeviceAndBrowser(userAgent);

    db.insert(analytics)
      .values({
        siteId,
        path: `/pixel/${campaignSource}`,
        referrer: req.headers.get("referer") || "Email / Newsletter",
        userAgent: userAgent.slice(0, 500),
        country,
        device,
        browser,
        os,
        utmSource: "pixel",
        utmMedium: "email",
        utmCampaign: campaignSource.slice(0, 100),
        ipHash,
        createdAt: new Date(),
      })
      .run();
  } catch (err: unknown) {
    console.error("[analytics/pixel] Error logging tracking pixel:", err instanceof Error ? err.message : err);
  }

  return gifResponse;
}
