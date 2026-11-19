"use server";

import { ROLE_ADMINS, ROLE_PUBLISHERS } from "@/lib/auth/roles";
import { requireSiteAccess } from "@/lib/auth/site-access";
import { revalidateAnalyticsPaths } from "@/lib/cache/revalidate";
import {
  createAnalyticsSegmentService,
  deleteAnalyticsSegmentService,
  getAnalyticsSegmentSiteId,
  resetSiteAnalyticsService,
} from "@/lib/services/analytics";

/** Result payload returned from analytics operations. */
export type AnalyticsMutationResponse<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/** Purges traffic records and resets post/page view counters for a tenant site. */
export async function resetAnalyticsAction(siteId: string): Promise<AnalyticsMutationResponse> {
  await requireSiteAccess(siteId, ROLE_ADMINS);
  if (!siteId || typeof siteId !== "string") {
    return { success: false, error: "Invalid site ID" };
  }

  try {
    resetSiteAnalyticsService(siteId);
    revalidateAnalyticsPaths();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reset analytics" };
  }
}

/** Creates a saved filter segment definition for a tenant site. */
export async function createSegmentAction(params: {
  siteId: string;
  name: string;
  filtersJson: string;
}): Promise<AnalyticsMutationResponse<{ id: string }>> {
  await requireSiteAccess(params.siteId, ROLE_PUBLISHERS);
  if (!params.siteId || !params.name?.trim()) {
    return { success: false, error: "Segment name and site ID are required" };
  }

  try {
    const id = createAnalyticsSegmentService(params.siteId, params.name, params.filtersJson);
    revalidateAnalyticsPaths();
    return { success: true, data: { id } };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create segment" };
  }
}

/** Removes a saved analytics filter segment belonging to an authorized site. */
export async function deleteSegmentAction(segmentId: string): Promise<AnalyticsMutationResponse> {
  if (!segmentId) {
    return { success: false, error: "Missing segment ID" };
  }

  const siteId = getAnalyticsSegmentSiteId(segmentId);
  if (!siteId) {
    return { success: false, error: "Segment not found" };
  }

  await requireSiteAccess(siteId, ROLE_PUBLISHERS);

  try {
    deleteAnalyticsSegmentService(segmentId);
    revalidateAnalyticsPaths();
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete segment" };
  }
}
