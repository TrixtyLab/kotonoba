import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { hasAdminUser } from "@/lib/tenant";
import { LoginClient } from "@/components/auth/LoginClient";

const pageIcons: Metadata["icons"] = {
  icon: [
    { url: "/icon.svg", type: "image/svg+xml" },
    { url: "/favicon.ico", sizes: "any" },
  ],
  shortcut: "/icon.svg",
  apple: "/icon.svg",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    icons: pageIcons,
  };
}

/**
 * Server page component rendering the login portal and determining whether to display the initial onboarding wizard link.
 *
 * @returns React JSX login view.
 */
export default async function LoginPage() {
  await connection();
  const showSetupLink = !hasAdminUser();

  return <LoginClient showSetupLink={showSetupLink} />;
}
