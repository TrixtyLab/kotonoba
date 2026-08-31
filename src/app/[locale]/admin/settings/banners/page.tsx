import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { getSiteBanners } from "@/lib/banners";
import { BannersSettingsClient } from "@/components/admin/settings/BannersSettingsClient";

/**
 * Server page component rendering the header and sidebar promotional banners configuration editor.
 *
 * @returns {Promise<React.JSX.Element>} React JSX banner settings view.
 */
export default async function BannersSettingsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const banners = await getSiteBanners(site.id);

  return <BannersSettingsClient siteId={site.id} initialBanners={banners} />;
}
