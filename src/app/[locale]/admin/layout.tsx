import { getCurrentUser } from "@/lib/auth/session";
import { getActiveSite } from "@/lib/tenant";
import { getAllSites } from "@/actions/sites";
import { redirect } from "@/i18n/routing";
import { AdminClientLayout } from "@/components/admin/AdminClientLayout";

/**
 * Server layout component enforcing role-based authentication and supplying multi-tenant site context to the admin panel shell.
 *
 * @param props - Object containing children elements and route params Promise.
 * @returns React JSX authenticated admin layout shell.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user || !user.exists) {
    redirect({ href: "/login", locale });
    return null;
  }

  const site = await getActiveSite();
  const allSites = await getAllSites();

  const currentSiteOption = site
    ? { id: site.id, name: site.name, domain: site.domain }
    : { id: "default", name: "Default Blog", domain: "localhost" };

  const allSiteOptions = allSites.map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
  }));

  return (
    <AdminClientLayout
      currentSite={currentSiteOption}
      allSites={allSiteOptions.length > 0 ? allSiteOptions : [currentSiteOption]}
      user={{
        displayName: user.email.split("@")[0],
        email: user.email,
        role: user.role,
      }}
    >
      {children}
    </AdminClientLayout>
  );
}
