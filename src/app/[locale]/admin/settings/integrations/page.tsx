import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { notFound } from "next/navigation";
import { IntegrationsSettingsClient } from "@/components/admin/settings/IntegrationsSettingsClient";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Server page component loading integration configurations (Discord Webhooks, RSS Feeds) for the active blog.
 *
 * @returns React JSX integrations settings view.
 */
export default async function IntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);

  return (
    <IntegrationsSettingsClient
      siteId={site.id}
      siteDomain={site.domain}
      siteName={getLocalizedText(site.name, locale)}
      initialSettings={settingsMap}
    />
  );
}
