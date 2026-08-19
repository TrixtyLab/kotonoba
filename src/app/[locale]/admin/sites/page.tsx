import { getActiveSite } from "@/lib/tenant";
import { getAllSites } from "@/actions/sites";
import { SitesManagerClient } from "@/components/admin/SitesManagerClient";
import { notFound } from "next/navigation";

/**
 * Server page component loading all registered website instances and rendering the multi-tenant blog manager.
 *
 * @returns React JSX sites manager view.
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
