import type { Metadata } from "next";
import { hasAdminUser } from "@/lib/tenant";
import { LoginClient } from "@/components/auth/LoginClient";

export const metadata: Metadata = {
  title: "Iniciar Sesión — Kotonoba Admin",
  description: "Inicia sesión en el panel de control de Kotonoba CMS",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

/**
 * Server page component rendering the login portal and determining whether to display the initial onboarding wizard link.
 *
 * @returns React JSX login view.
 */
export default async function LoginPage() {
  const showSetupLink = !hasAdminUser();

  return <LoginClient showSetupLink={showSetupLink} />;
}
