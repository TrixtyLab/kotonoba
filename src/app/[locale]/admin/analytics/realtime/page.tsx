import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { getRealtimeFeedData, type RealtimeDataResponse } from "@/lib/analytics/realtime";
import { RealtimeFeedClient } from "@/components/admin/analytics/RealtimeFeedClient";

/**
 * Realtime telemetry page initializing and mounting the dynamic client-side live activity feed.
 *
 * @returns {Promise<React.JSX.Element>} Realtime monitoring view.
 */
export default async function AnalyticsRealtimePage(): Promise<React.JSX.Element> {
  const site = await getActiveSite();
  if (!site) notFound();

  let initialData: RealtimeDataResponse = { activeVisitorsNow: 0, recentHits: [], activePages: [] };
  try {
    initialData = await getRealtimeFeedData(site.id);
  } catch {
    // Graceful fallback if database query fails during prerender
  }

  return <RealtimeFeedClient siteId={site.id} initialData={initialData} />;
}
