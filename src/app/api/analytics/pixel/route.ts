import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { analytics } from "@/lib/db/schema";
import {
  checkAnalyticsIpRateLimit,
  checkAnalyticsSiteRateLimit,
  hashAnalyticsVisitor,
  resolveAnalyticsSite,
  sanitizeCampaignToken,
} from "@/lib/analytics/ingest";
import { getClientIp } from "@/lib/http/request";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";

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
 * The target site must match the request host; invalid or cross-tenant requests still
 * return the GIF so tracking pixels never expose tenant existence to third parties.
 *
 * @param {NextRequest} req - Inbound HTTP request containing query parameters `sid` (siteId) and optional `src` (campaign tag).
 * @returns {Promise<NextResponse>} 1x1 GIF binary response with non-caching HTTP headers.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gifResponse = new NextResponse(new Uint8Array(TRANSPARENT_GIF_BUFFER), {
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
  const siteId = searchParams.get("sid")?.trim() || "";

  if (!siteId || siteId.length > 128) {
    return gifResponse;
  }

  const rawIp = getClientIp(req.headers);
  const ipRate = checkAnalyticsIpRateLimit("pixel", rawIp);
  if (!ipRate.allowed) {
    return gifResponse;
  }

  const userAgent = req.headers.get("user-agent") || "";
  if (BOT_USER_AGENTS.test(userAgent)) {
    return gifResponse;
  }

  const resolution = await resolveAnalyticsSite(siteId);
  if (!resolution.ok) {
    return gifResponse;
  }

  const siteRate = checkAnalyticsSiteRateLimit("pixel", rawIp, resolution.siteId);
  if (!siteRate.allowed) {
    return gifResponse;
  }

  const campaignSource = sanitizeCampaignToken(searchParams.get("src"));

  try {
    const ipHash = hashAnalyticsVisitor(rawIp, userAgent);
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || undefined;
    const { device, browser, os } = parseDeviceAndBrowser(userAgent);

    getDb()
      .insert(analytics)
      .values({
        siteId: resolution.siteId,
        path: `/pixel/${campaignSource}`,
        referrer: (req.headers.get("referer") || "Email / Newsletter").slice(0, 500),
        userAgent: userAgent.slice(0, 500),
        country,
        device,
        browser,
        os,
        utmSource: "pixel",
        utmMedium: "email",
        utmCampaign: campaignSource,
        ipHash,
        createdAt: new Date(),
      })
      .run();
  } catch (err: unknown) {
    console.error("[analytics/pixel] Error logging tracking pixel:", err instanceof Error ? err.message : err);
  }

  return gifResponse;
}
