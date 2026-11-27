import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { buildSiteRssFeedXml } from "@/lib/feeds/build";

export const dynamic = "force-dynamic";

/**
 * Generates an RSS 2.0 XML document containing recent published articles for the active blog tenant.
 *
 * @returns Promise resolving to an XML-formatted NextResponse stream.
 */
export async function GET(): Promise<NextResponse> {
  const reqHeaders = await headers();
  const result = await buildSiteRssFeedXml(reqHeaders);

  if (!result.ok) {
    return new NextResponse(result.message, { status: result.status });
  }

  return new NextResponse(result.xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
