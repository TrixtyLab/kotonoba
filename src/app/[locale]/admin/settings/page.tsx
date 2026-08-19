import { redirect } from "@/i18n/routing";

/**
 * Administrative settings index route immediately redirecting visitors to the general settings sub-panel.
 *
 * @param props - Object containing route params Promise with active locale.
 */
export default async function AdminSettingsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/admin/settings/general", locale });
}
