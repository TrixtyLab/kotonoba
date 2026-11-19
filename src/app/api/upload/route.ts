import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessSite } from "@/lib/auth/site-access";
import { ROLE_ALL } from "@/lib/auth/roles";
import { getAdminSite } from "@/lib/tenant";
import { getEnvConfig } from "@/lib/config/env";
import { detectImageTypeFromBytes, sanitizeUploadedImage } from "@/lib/security/upload";
import { isSameOriginRequest } from "@/lib/http/request";
import { getSiteStorageUsageBytes, sanitizePath, uploadToStorage } from "@/lib/storage";

const ALLOWED_UPLOAD_ROLES = new Set<string>(ROLE_ALL);

/**
 * Multipart file upload endpoint accepting verified image files and storing them under the tenant's directory.
 *
 * @param req - The incoming NextRequest containing the multipart file payload.
 * @returns JSON response containing public URL, filename, and file size.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req.headers)) {
    return NextResponse.json({ error: "Cross-origin upload rejected" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_UPLOAD_ROLES.has(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawFolder = (formData.get("folder") as string) || "";
    const requestedSiteId = (formData.get("siteId") as string) || "";

    let targetSiteId: string | undefined;
    if (requestedSiteId) {
      if (!canAccessSite(user, requestedSiteId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetSiteId = requestedSiteId;
    } else {
      const activeSite = await getAdminSite();
      targetSiteId = activeSite?.id || user.siteId || undefined;
    }

    if (!targetSiteId) {
      return NextResponse.json({ error: "Active site context is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { maxUploadSize, maxSiteStorageBytes } = getEnvConfig();
    if (file.size === 0 || file.size > maxUploadSize) {
      return NextResponse.json(
        { error: `File must be between 1 byte and ${Math.round(maxUploadSize / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);
    const detected = detectImageTypeFromBytes(rawBuffer);

    if (!detected) {
      return NextResponse.json(
        { error: "Invalid image binary content. Allowed formats: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.type && file.type !== detected.mimeType && !(file.type === "image/jpg" && detected.mimeType === "image/jpeg")) {
      return NextResponse.json(
        { error: "Declared MIME type does not match actual image contents" },
        { status: 400 }
      );
    }

    const sanitized = await sanitizeUploadedImage(rawBuffer, detected);
    if (!sanitized) {
      return NextResponse.json(
        { error: "Corrupted, oversized dimension, or invalid image binary payload" },
        { status: 400 }
      );
    }

    if (maxSiteStorageBytes > 0) {
      const currentUsage = await getSiteStorageUsageBytes(targetSiteId);
      if (currentUsage + sanitized.buffer.length > maxSiteStorageBytes) {
        return NextResponse.json(
          { error: "Storage quota exceeded for this site" },
          { status: 413 }
        );
      }
    }

    const folder = sanitizePath(rawFolder);
    const baseWithoutExt = path.basename(file.name, path.extname(file.name)) || "image";
    const safeFilename = `${baseWithoutExt}${sanitized.extension}`;

    const result = await uploadToStorage(
      sanitized.buffer,
      safeFilename,
      sanitized.mimeType,
      folder,
      targetSiteId
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      path: result.path,
      size: result.size,
      mimeType: result.mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload file";
    const status = message === "FORBIDDEN_MEDIA_PATH" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
