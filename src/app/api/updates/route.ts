import { NextResponse } from "next/server";
import { checkForUpdates, getCurrentVersion } from "@/actions/updates";

/**
 * Public/Admin endpoint returning application update status and version metrics.
 *
 * @returns {Promise<NextResponse>} JSON response containing UpdateInfo structure.
 */
export async function GET(): Promise<NextResponse> {
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
      { status: 200 }
    );
  }
}
