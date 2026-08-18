import { getActiveSite } from "@/lib/tenant";
import { getSiteSettings } from "@/actions/settings";
import { SettingsClient } from "@/components/admin/SettingsClient";
import { notFound } from "next/navigation";

/**
 * Admin settings page for configuring theme, domain, SEO, and AI endpoints.
 */
export default async function AdminSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const settingsMap = await getSiteSettings(site.id);

  return (
    <SettingsClient
      site={{
        ...site,
        theme: (site.theme as "dark" | "light") || "dark",
      }}
      initialSettings={settingsMap}
    />
  );
}
