import { getAdminSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { BackupSettingsClient } from "@/components/admin/settings/BackupSettingsClient";

/**
 * Server page component rendering the backup export and ZIP restoration settings editor.
 *
 * @returns React JSX backup settings view.
 */
export default async function BackupSettingsPage() {
  const site = await getAdminSite();
  if (!site) notFound();

  return <BackupSettingsClient siteId={site.id} />;
}
