import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { analyticsSegments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SegmentsManagerClient, SegmentItem } from "@/components/admin/analytics/SegmentsManagerClient";

/**
 * Analytics segments page listing saved dimension filters and mounting the interactive creator.
 *
 * @returns {Promise<React.JSX.Element>} Rendered segments management view.
 */
export default async function AnalyticsSegmentsPage(): Promise<React.JSX.Element> {
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const rows = db
    .select({
      id: analyticsSegments.id,
      name: analyticsSegments.name,
      filters: analyticsSegments.filters,
      createdAt: analyticsSegments.createdAt,
    })
    .from(analyticsSegments)
    .where(eq(analyticsSegments.siteId, site.id))
    .orderBy(desc(analyticsSegments.createdAt))
    .all();

  const initialSegments: SegmentItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: r.filters,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
  }));

  return <SegmentsManagerClient siteId={site.id} initialSegments={initialSegments} />;
}
