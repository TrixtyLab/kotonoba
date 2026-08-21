import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getStorageConfig, getS3Client } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Public file server endpoint resolving media asset paths dynamically.
 * Generates fresh presigned URLs on demand for S3/R2 private buckets or streams local disk files.
 *
 * @param _req - Incoming NextRequest object.
 * @param context - Request context containing path segment parameters.
 * @returns Fresh presigned URL redirection or binary file response.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("File Not Found", { status: 404 });
  }

  const sanitizedSegments = pathSegments.map((s) => path.basename(s));
  const relativePath = sanitizedSegments.join("/");
  const config = getStorageConfig();

  // If Cloudflare R2 or AWS S3 is active
  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      // If custom public CDN domain is configured, redirect directly
      if (config.publicUrl && !config.publicUrl.includes("r2.cloudflarestorage.com")) {
        return NextResponse.redirect(`${config.publicUrl}/${relativePath}`, {
          status: 307,
        });
      }

      // Generate a fresh presigned URL valid for 1 hour on each request
      const s3 = getS3Client(config);
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: relativePath,
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return NextResponse.redirect(signedUrl, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      });
    } catch {
      return new NextResponse("File Not Found", { status: 404 });
    }
  }

  // Local filesystem fallback
  const filePath = path.join(/*turbopackIgnore: true*/ config.uploadDir, relativePath);

  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return new NextResponse("File Not Found", { status: 404 });
  }

  try {
    const fileBuffer = await fs.readFile(/*turbopackIgnore: true*/ filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Error reading file", { status: 500 });
  }
}
