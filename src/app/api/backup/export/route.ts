import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createSiteBackupZip } from "@/lib/backup/export";

/**
 * HTTP GET endpoint streaming a compressed ZIP archive containing all site database entities, media assets, and manifest metadata.
 *
 * @param req - The incoming NextRequest containing the target siteId query parameter.
 * @returns Binary ZIP stream response or 401/400 error status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists || !["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "Query parameter 'siteId' is required." }, { status: 400 });
  }

  try {
    const { buffer, filename } = await createSiteBackupZip(siteId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
