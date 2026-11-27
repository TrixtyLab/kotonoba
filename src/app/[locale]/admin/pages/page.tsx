import { getAdminSite } from "@/lib/tenant";
import { getPages } from "@/actions/pages";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils/date";
import { PagesListClient } from "@/components/admin/PagesListClient";

/**
 * Server page component loading and rendering the administrative custom pages management table.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving to route parameters with active locale code.
 * @returns {Promise<React.JSX.Element>} React JSX pages list view.
 */
export default async function AdminPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [site, user] = await Promise.all([getAdminSite(), getCurrentUser()]);
  const rawPages = site ? await getPages(site.id) : [];
  const viewer = { id: user?.userId ?? "", role: user?.role ?? "author" };

  const pageList = rawPages.map((p) => ({
    ...p,
    publishedAtFormatted: p.publishedAt ? formatDate(p.publishedAt, locale) : null,
    createdAtFormatted: formatDate(p.createdAt, locale),
  }));

  return <PagesListClient initialPages={pageList} viewer={viewer} />;
}
