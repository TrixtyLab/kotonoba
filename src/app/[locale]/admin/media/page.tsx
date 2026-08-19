import { getStorageStatus } from "@/lib/storage";
import { MediaManagerClient } from "@/components/admin/MediaManagerClient";

/**
 * Server page component querying active storage status and rendering the media assets library.
 *
 * @returns React JSX media library view.
 */
export default async function AdminMediaPage() {
  const storageInfo = getStorageStatus();

  return (
    <MediaManagerClient
      storageInfo={storageInfo}
    />
  );
}
