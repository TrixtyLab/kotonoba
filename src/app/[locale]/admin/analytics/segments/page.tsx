import { getAdminSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { listSavedAnalyticsSegments } from "@/lib/queries/analytics-overview";
import { SegmentsManagerClient, SegmentItem } from "@/components/admin/analytics/SegmentsManagerClient";

/**
 * Analytics segments page listing saved dimension filters and mounting the interactive creator.
 *
 * @returns {Promise<React.JSX.Element>} Rendered segments management view.
 */
export default async function AnalyticsSegmentsPage(): Promise<React.JSX.Element> {
  const site = await getAdminSite();
  if (!site) notFound();

  const rows = listSavedAnalyticsSegments(site.id);

  const initialSegments: SegmentItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: r.filters,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
  }));

  return <SegmentsManagerClient siteId={site.id} initialSegments={initialSegments} />;
}
