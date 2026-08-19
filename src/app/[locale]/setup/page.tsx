import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { or, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SetupWizardClient } from "@/components/setup/SetupWizardClient";

/**
 * Server page component guarding the initial setup wizard and redirecting to login if an administrator account already exists.
 *
 * @param props - Object containing route params Promise with active locale.
 * @returns React JSX setup wizard view.
 */
export default async function SetupWizardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const db = getDb();

  const existingAdmin = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(or(eq(users.role, "super_admin"), eq(users.role, "admin")))
    .get();

  if (existingAdmin && existingAdmin.count > 0) {
    redirect(`/${locale}/login`);
  }

  return <SetupWizardClient />;
}
