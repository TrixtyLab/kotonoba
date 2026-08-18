import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureDir } from "@/lib/utils/fs";
import { generateId } from "@/lib/utils/slug";
import path from "path";
import fs from "fs/promises";

function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || "10485760", 10);

/**
 * Handles image and media uploads for the Tiptap editor and site branding.
 * Validates authentication, mime-type, and file size before persisting to disk.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds maximum upload size (10MB)" }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    ensureDir(uploadDir);

    const ext = path.extname(file.name) || ".jpg";
    const filename = `${generateId()}${ext}`;
    const destinationPath = path.join(/*turbopackIgnore: true*/ uploadDir, filename);

    const bytes = await file.arrayBuffer();
    await fs.writeFile(destinationPath, Buffer.from(bytes));

    const publicUrl = `/api/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      mimeType: file.type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
