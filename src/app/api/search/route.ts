import { NextRequest, NextResponse } from "next/server";
import { getPublicSite } from "@/lib/tenant";
import { parsePageNumber, searchPublicPostsPaginated } from "@/lib/queries/public-posts";
import { MAX_PUBLIC_PAGE_SIZE, SEARCH_PAGE_LIMIT } from "@/lib/config/constants";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/http/request";

export const dynamic = "force-dynamic";

/**
 * Tenant-scoped paginated public article search endpoint backing `SearchModal` without serializing
 * the entire post corpus into every public SSR layout response.
 *
 * @param req - Incoming `NextRequest` with `?q=`, `?page=`, and optional `?limit=` search parameters.
 * @returns JSON response containing matching published article summaries and pagination flags.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`search:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many search requests" }, { status: 429 });
  }

  const site = await getPublicSite();
  if (!site) {
    return NextResponse.json({
      items: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      hasMore: false,
    });
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const page = parsePageNumber(req.nextUrl.searchParams.get("page"));
  const rawLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(rawLimit, MAX_PUBLIC_PAGE_SIZE))
    : SEARCH_PAGE_LIMIT;

  const result = searchPublicPostsPaginated({
    siteId: site.id,
    query: q,
    page,
    limit,
  });

  return NextResponse.json(result);
}
