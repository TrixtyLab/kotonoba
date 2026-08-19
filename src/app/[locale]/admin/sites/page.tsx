import { getActiveSite } from "@/lib/tenant";
import { getAllSites } from "@/actions/sites";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/routing";
import { SitesManagerClient } from "@/components/admin/SitesManagerClient";
import { notFound } from "next/navigation";

/**
 * Server page component loading all registered website instances and rendering the multi-tenant blog manager.
 * Restricted to super administrators.
 *
 * @returns React JSX sites manager view.
 */
export default async function AdminSitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser || !currentUser.exists) {
    redirect({ href: "/login", locale });
    return null;
  }

  if (currentUser.role !== "super_admin") {
    redirect({ href: "/admin", locale });
    return null;
  }

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
