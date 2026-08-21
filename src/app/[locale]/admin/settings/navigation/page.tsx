import { getActiveSite } from "@/lib/tenant";
import { getPublishedPages } from "@/actions/pages";
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

  const pages = await getPublishedPages(site.id);

  return <NavigationSettingsClient site={site} availablePages={pages} />;
}
