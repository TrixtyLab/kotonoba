import { NextRequest, NextResponse } from "next/server";
import { buildMediaAssetHeaders, readStoredMediaObject } from "@/lib/storage";
import { getRequestNormalizedHost, getSiteForHost, normalizeDomain } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const VALID_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function isLocalMediaHost(host: string): boolean {
  const clean = normalizeDomain(host);
  return clean === "localhost" || clean === "127.0.0.1" || clean === "::1" || clean.endsWith(".localhost");
}

/**
 * Public file server endpoint resolving media asset paths dynamically while preserving
 * strict path traversal boundaries, tenant storage selection, and direct proxy streaming.
 *
 * @param req - Incoming NextRequest object.
 * @param context - Request context containing path segment parameters.
 * @returns Binary/streamed file response without external bucket redirection.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("File Not Found", { status: 404 });
  }

  for (const rawSeg of pathSegments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSeg);
    } catch {
      return new NextResponse("File Not Found", { status: 404 });
    }

    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.startsWith(".") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      !VALID_SEGMENT.test(decoded)
    ) {
      return new NextResponse("File Not Found", { status: 404 });
    }
  }

  const normalizedSegments = pathSegments.map((s) => decodeURIComponent(s));
  const relativePath = normalizedSegments.join("/");

  let siteIdForConfig: string | undefined;
  if (normalizedSegments[0] === "sites") {
    if (normalizedSegments.length < 3) {
      return new NextResponse("File Not Found", { status: 404 });
    }
    const candidateSiteId = normalizedSegments[1];
    const siteExists = getDb().select({ id: sites.id }).from(sites).where(eq(sites.id, candidateSiteId)).get();
    if (!siteExists) {
      return new NextResponse("File Not Found", { status: 404 });
    }
    const requestHost = await getRequestNormalizedHost();
    if (!isLocalMediaHost(requestHost)) {
      const hostSite = await getSiteForHost();
      if (!hostSite || hostSite.id !== candidateSiteId) {
        return new NextResponse("File Not Found", { status: 404 });
      }
    }
    siteIdForConfig = candidateSiteId;
  } else {
    const hostSite = await getSiteForHost();
    siteIdForConfig = hostSite?.id;
  }

  try {
    const mediaObject = await readStoredMediaObject(relativePath, {
      siteId: siteIdForConfig,
      ifNoneMatch: req.headers.get("if-none-match"),
    });

    if (mediaObject.status === "not-found") {
      return new NextResponse("File Not Found", { status: 404 });
    }

    if (mediaObject.status === "not-modified") {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(mediaObject.etag ? { ETag: mediaObject.etag } : {}),
        },
      });
    }

    return new NextResponse(mediaObject.body as BodyInit, {
      status: 200,
      headers: buildMediaAssetHeaders(mediaObject, "public, max-age=31536000, immutable"),
    });
  } catch (error) {
    console.error("Failed to read stored media object:", error);
    return new NextResponse("Error reading file", { status: 500 });
  }
}
