import { NextRequest, NextResponse } from "next/server";
import { getPublicSite } from "@/lib/tenant";
import { searchPublicPosts } from "@/lib/queries/public-posts";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/http/request";

export const dynamic = "force-dynamic";

/**
 * Tenant-scoped public article search endpoint backing `SearchModal` without serializing
 * the entire post corpus into every public SSR layout response.
 *
 * @param req - Incoming `NextRequest` with `?q=` search parameter.
 * @returns JSON response containing matching published article summaries.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`search:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many search requests" }, { status: 429 });
  }

  const site = await getPublicSite();
  if (!site) {
    return NextResponse.json({ items: [] });
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const items = searchPublicPosts(site.id, q, 25);

  return NextResponse.json({ items });
}
