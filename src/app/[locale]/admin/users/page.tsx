import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/routing";
import { getUsers } from "@/actions/users";
import { getAllSites } from "@/actions/sites";
import { UsersManagerClient } from "@/components/admin/UsersManagerClient";

/**
 * Server page component for team member and user role administration.
 *
 * @returns React JSX user management interface.
 */
export default async function AdminUsersPage({
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

  if (currentUser.role !== "super_admin" && currentUser.role !== "admin") {
    redirect({ href: "/admin", locale });
    return null;
  }

  const [usersList, allSites] = await Promise.all([
    getUsers(),
    getAllSites(),
  ]);

  return (
    <UsersManagerClient
      initialUsers={usersList}
      availableSites={allSites.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
      }))}
      currentUserId={currentUser.userId}
      currentUserRole={currentUser.role as "super_admin" | "admin" | "editor" | "author"}
    />
  );
}
