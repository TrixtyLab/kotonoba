import { getAdminSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { getStorageEnvSummary } from "@/lib/config/env";
import { notFound } from "next/navigation";
import { StorageSettingsClient, type EnvStorageInfo } from "@/components/admin/settings/StorageSettingsClient";

/**
 * Server page component loading current storage backend configurations and rendering the storage settings editor.
 *
 * @returns React JSX storage settings view.
 */
export default async function StorageSettingsPage() {
  const site = await getAdminSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);
  const envStorageInfo: EnvStorageInfo = getStorageEnvSummary();

  return <StorageSettingsClient siteId={site.id} initialSettings={settingsMap} envStorageInfo={envStorageInfo} />;
}
