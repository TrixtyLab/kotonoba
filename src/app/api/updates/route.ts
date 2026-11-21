import { NextResponse } from "next/server";
import { checkForUpdates, getCurrentVersion } from "@/lib/observability/updates";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageSettings } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * Authenticated admin endpoint returning application update status and version metrics.
 * Rejects unauthenticated and non-administrative sessions to avoid public CMS fingerprinting.
 *
 * @returns JSON response containing UpdateInfo structure or 401/403 error.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const info = await checkForUpdates();
    return NextResponse.json(info, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    const currentVersion = await getCurrentVersion().catch(() => "1.0.19");
    return NextResponse.json(
      {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: "https://github.com/TrixtyLab/kotonoba/releases",
        containerUrl: "https://github.com/TrixtyLab/kotonoba/pkgs/container/kotonoba",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
