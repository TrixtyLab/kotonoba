import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getStorageConfig, getS3Client } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Public file server endpoint streaming media asset binaries from local disk or private R2/S3 storage.
 *
 * @param _req - Incoming NextRequest object.
 * @param context - Request context containing path segment parameters.
 * @returns Binary file response with MIME content-type headers.
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

  // If Cloudflare R2 or AWS S3 is active, stream from the private bucket
  if ((config.provider === "r2" || config.provider === "s3") && config.bucket && config.accessKeyId) {
    try {
      const s3 = getS3Client(config);
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: relativePath,
      });

      const s3Response = await s3.send(command);
      if (!s3Response.Body) {
        return new NextResponse("File Not Found", { status: 404 });
      }

      const byteArray = await s3Response.Body.transformToByteArray();
      const ext = path.extname(relativePath).toLowerCase();
      const contentType = s3Response.ContentType || MIME_MAP[ext] || "application/octet-stream";

      return new NextResponse(Buffer.from(byteArray), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
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
