import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { notFound } from "next/navigation";
import { StorageSettingsClient } from "@/components/admin/settings/StorageSettingsClient";

/**
 * Server page component loading current storage backend configurations and rendering the storage settings editor.
 *
 * @returns React JSX storage settings view.
 */
export default async function StorageSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);
  return <StorageSettingsClient siteId={site.id} initialSettings={settingsMap} />;
}
