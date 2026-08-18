import { getActiveSite } from "@/lib/tenant";
import { getAllSites } from "@/actions/sites";
import { SitesManagerClient } from "@/components/admin/SitesManagerClient";
import { notFound } from "next/navigation";

/**
 * Admin page for managing multiple tenant blogs and custom domain routing.
 */
export default async function AdminSitesPage() {
  const currentSite = await getActiveSite();
  if (!currentSite) notFound();

  const allSites = await getAllSites();

  return (
    <SitesManagerClient
      currentSiteId={currentSite.id}
      initialSites={allSites}
    />
  );
}
