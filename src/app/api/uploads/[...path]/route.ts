import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

/**
 * Resolves the absolute local filesystem directory used for persistent uploads.
 *
 * @returns Absolute directory path string.
 */
function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
}

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Public file server endpoint streaming local media asset binaries from persistent disk storage.
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

  // Prevent directory traversal
  const sanitizedSegments = pathSegments.map((s) => path.basename(s));
  const relativePath = sanitizedSegments.join("/");
  const filePath = path.join(/*turbopackIgnore: true*/ getUploadDir(), relativePath);

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
