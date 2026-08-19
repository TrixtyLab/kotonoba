import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getActiveSite } from "@/lib/tenant";
import { getAllSites } from "@/actions/sites";
import { redirect } from "@/i18n/routing";
import { AdminClientLayout } from "@/components/admin/AdminClientLayout";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Dynamically computes metadata and custom favicon configuration for the admin panel.
 *
 * @returns Metadata object with custom favicon icons.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getActiveSite();
  const favicon = site?.faviconUrl || "/favicon.ico";
  return {
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
  };
}

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

  const allSites = await getAllSites();

  // If user is super_admin or user.siteId is null/empty -> Global (access to all sites)
  // Otherwise -> Restricted strictly to user's assigned site
  const isGlobalUser = user.role === "super_admin" || !user.siteId;
  const accessibleSites = isGlobalUser
    ? allSites
    : allSites.filter((s) => s.id === user.siteId);

  const site = await getActiveSite();

  // Fallback to assigned site if activeSite is not accessible to this user
  const effectiveSite =
    site && accessibleSites.some((s) => s.id === site.id)
      ? site
      : accessibleSites[0] || site;

  const currentSiteOption = effectiveSite
    ? { id: effectiveSite.id, name: getLocalizedText(effectiveSite.name, locale), domain: effectiveSite.domain }
    : { id: "default", name: "Default Blog", domain: "localhost" };

  const allSiteOptions = accessibleSites.map((s) => ({
    id: s.id,
    name: getLocalizedText(s.name, locale),
    domain: s.domain,
  }));

  const canManageSites = user.role === "super_admin";

  return (
    <AdminClientLayout
      currentSite={currentSiteOption}
      allSites={allSiteOptions.length > 0 ? allSiteOptions : [currentSiteOption]}
      canManageSites={canManageSites}
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
