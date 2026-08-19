import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listMediaFiles,
  deleteFromStorage,
  createFolder,
  moveMediaItem,
  getStorageStatus,
} from "@/lib/storage";

/**
 * HTTP GET handler retrieving directory listings of media assets and subfolders.
 *
 * @param req - The incoming NextRequest containing the target folder query parameter.
 * @returns JSON listing of files, folders, and storage backend status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder") || "";

  try {
    const listing = await listMediaFiles(folder, user.siteId || undefined);
    const status = getStorageStatus(user.siteId || undefined);

    return NextResponse.json({
      success: true,
      currentFolder: listing.currentFolder,
      parentFolder: listing.parentFolder,
      folders: listing.folders,
      files: listing.files,
      storage: status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * HTTP POST handler executing media asset actions including folder creation, file relocation, and deletions.
 *
 * @param req - The incoming NextRequest containing action payload.
 * @returns JSON operation status.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "createFolder") {
      const { folderName, parentFolder } = body;
      if (!folderName) {
        return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
      }
      const success = await createFolder(folderName, parentFolder || "", user.siteId || undefined);
      if (!success) {
        return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "move") {
      const { itemPath, targetFolder } = body;
      if (!itemPath) {
        return NextResponse.json({ error: "Item path is required" }, { status: 400 });
      }
      const success = await moveMediaItem(itemPath, targetFolder || "", user.siteId || undefined);
      if (!success) {
        return NextResponse.json({ error: "Failed to move item" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Media operation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const itemPath = body.path || body.filename;
    const isFolder = Boolean(body.isFolder);

    if (!itemPath) {
      return NextResponse.json({ error: "Item path is required" }, { status: 400 });
    }

    const success = await deleteFromStorage(itemPath, isFolder, user.siteId || undefined);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete media item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
