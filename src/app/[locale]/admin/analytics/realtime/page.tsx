import { getActiveSite } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { getRealtimeFeedAction } from "@/actions/analytics";
import { RealtimeFeedClient } from "@/components/admin/analytics/RealtimeFeedClient";

/**
 * Realtime telemetry page initializing and mounting the dynamic client-side live activity feed.
 *
 * @returns {Promise<React.JSX.Element>} Realtime monitoring view.
 */
export default async function AnalyticsRealtimePage(): Promise<React.JSX.Element> {
  const site = await getActiveSite();
  if (!site) notFound();

  const feedResponse = await getRealtimeFeedAction(site.id);
  const initialData = feedResponse.success && feedResponse.data
    ? feedResponse.data
    : { activeVisitorsNow: 0, recentHits: [], activePages: [] };

  return <RealtimeFeedClient siteId={site.id} initialData={initialData} />;
}
