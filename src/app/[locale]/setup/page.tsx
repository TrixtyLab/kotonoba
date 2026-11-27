import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { hasAdminUser } from "@/lib/tenant";
import { redirect } from "@/i18n/routing";
import { SetupWizardClient } from "@/components/setup/SetupWizardClient";

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
  const t = await getTranslations({ locale, namespace: "setup" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    icons: pageIcons,
  };
}

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
  await connection();
  const { locale } = await params;

  if (hasAdminUser()) {
    redirect({ href: "/login", locale });
  }

  return <SetupWizardClient />;
}
