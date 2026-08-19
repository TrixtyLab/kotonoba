import { hasAdminUser } from "@/lib/tenant";
import { redirect } from "@/i18n/routing";
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

  if (hasAdminUser()) {
    redirect({ href: "/login", locale });
  }

  return <SetupWizardClient />;
}
