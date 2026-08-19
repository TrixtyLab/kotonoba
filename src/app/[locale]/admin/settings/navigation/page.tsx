import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { NavigationSettingsClient } from "@/components/admin/settings/NavigationSettingsClient";

/**
 * Server page component rendering the navigation menu configuration editor.
 *
 * @returns React JSX navigation settings view.
 */
export default async function NavigationSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  return <NavigationSettingsClient site={site} />;
}
