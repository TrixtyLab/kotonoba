import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { or, eq, sql } from "drizzle-orm";
import { LoginClient } from "@/components/auth/LoginClient";

/**
 * Server page component rendering the login portal and determining whether to display the initial onboarding wizard link.
 *
 * @returns React JSX login view.
 */
export default async function LoginPage() {
  const db = getDb();
  const existingAdmin = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(or(eq(users.role, "super_admin"), eq(users.role, "admin")))
    .get();

  const showSetupLink = !(existingAdmin && existingAdmin.count > 0);

  return <LoginClient showSetupLink={showSetupLink} />;
}
