import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { notFound } from "next/navigation";
import { AiSettingsClient } from "@/components/admin/settings/AiSettingsClient";

/**
 * Server page component loading current AI configuration and rendering the AI assistant settings editor.
 *
 * @returns React JSX AI settings view.
 */
export default async function AiSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);
  return <AiSettingsClient siteId={site.id} initialSettings={settingsMap} />;
}
