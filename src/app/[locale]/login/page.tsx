import { hasAdminUser } from "@/lib/tenant";
import { LoginClient } from "@/components/auth/LoginClient";

/**
 * Server page component rendering the login portal and determining whether to display the initial onboarding wizard link.
 *
 * @returns React JSX login view.
 */
export default async function LoginPage() {
  const showSetupLink = !hasAdminUser();

  return <LoginClient showSetupLink={showSetupLink} />;
}
