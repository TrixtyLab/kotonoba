import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { BrandingSettingsClient } from "@/components/admin/settings/BrandingSettingsClient";

/**
 * Server page component rendering the branding and visual theme settings editor.
 *
 * @returns React JSX branding settings view.
 */
export default async function BrandingSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  return <BrandingSettingsClient site={site} />;
}
