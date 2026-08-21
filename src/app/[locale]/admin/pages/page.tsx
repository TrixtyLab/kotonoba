import { getActiveSite } from "@/lib/tenant";
import { getPages } from "@/actions/pages";
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
  const site = await getActiveSite();
  const rawPages = site ? await getPages(site.id) : [];

  const pageList = rawPages.map((p) => ({
    ...p,
    publishedAtFormatted: p.publishedAt ? formatDate(p.publishedAt, locale) : null,
    createdAtFormatted: formatDate(p.createdAt, locale),
  }));

  return <PagesListClient initialPages={pageList} />;
}
