import { NextResponse } from "next/server";
import { checkForUpdates } from "@/actions/updates";

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
    return NextResponse.json(
      {
        updateAvailable: false,
        currentVersion: "1.0.0",
        latestVersion: "1.0.0",
        releaseUrl: "https://github.com/TrixtyLab/kotonoba/releases",
        containerUrl: "https://github.com/TrixtyLab/kotonoba/pkgs/container/kotonoba",
      },
      { status: 200 }
    );
  }
}
