import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { isDubConfigured } from "@/lib/dub";
import { notFound } from "next/navigation";
import { SeoSettingsClient } from "@/components/admin/settings/SeoSettingsClient";

/**
 * Server page component loading current SEO settings and rendering the SEO and LLMs.txt editor.
 *
 * @returns React JSX SEO settings view.
 */
export default async function SeoSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);
  return (
    <SeoSettingsClient
      siteId={site.id}
      initialSettings={settingsMap}
      isDubConfigured={isDubConfigured()}
    />
  );
}
