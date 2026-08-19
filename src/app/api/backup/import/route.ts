import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { restoreSiteBackupZip } from "@/lib/backup/import";

/**
 * HTTP POST endpoint accepting multipart upload of a backup ZIP archive to restore database entities and media files.
 *
 * @param req - The incoming NextRequest containing the multipart ZIP payload.
 * @returns JSON response summarizing restoration entity counts.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists || !["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const siteId = formData.get("siteId") as string | null;
    const mode = (formData.get("mode") as "merge" | "replace") || "merge";

    if (!file) {
      return NextResponse.json({ error: "No backup ZIP file provided." }, { status: 400 });
    }

    if (!siteId) {
      return NextResponse.json({ error: "Target siteId is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Uploaded file must be a .zip archive." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await restoreSiteBackupZip(buffer, siteId, {
      mode,
      currentUserId: user.userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to restore backup." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      stats: result.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
