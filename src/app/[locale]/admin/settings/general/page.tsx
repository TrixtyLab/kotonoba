import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { GeneralSettingsClient } from "@/components/admin/settings/GeneralSettingsClient";

/**
 * Server page component rendering the general site settings editor for localized blog titles and descriptions.
 *
 * @returns React JSX general settings view.
 */
export default async function GeneralSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  return <GeneralSettingsClient site={site} />;
}
