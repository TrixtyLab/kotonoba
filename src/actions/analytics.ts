"use server";

import { getDb } from "@/lib/db";
import { analytics, posts, pages, analyticsSegments } from "@/lib/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from analytics operations.
 */
export type AnalyticsMutationResponse<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Purges all historical traffic records, device analytics, and resets post and custom page view counters for a specific blog site.
 *
 * @param {string} siteId - Target blog site unique database identifier.
 * @returns {Promise<AnalyticsMutationResponse>} A Promise resolving to an AnalyticsMutationResponse object.
 * @throws {Error} If the authenticated session lacks super_admin or admin authorization.
 */
export async function resetAnalyticsAction(siteId: string): Promise<AnalyticsMutationResponse> {
  await requireAuth(["super_admin", "admin"]);

  if (!siteId || typeof siteId !== "string") {
    return { success: false, error: "Invalid site ID" };
  }

  try {
    const db = getDb();

    db.delete(analytics).where(eq(analytics.siteId, siteId)).run();
    db.update(posts).set({ views: 0 }).where(eq(posts.siteId, siteId)).run();
    db.update(pages).set({ views: 0 }).where(eq(pages.siteId, siteId)).run();

    revalidatePath("/admin/analytics", "layout");
    revalidatePath("/admin");
    revalidatePath("/admin/posts");
    revalidatePath("/admin/pages");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset analytics";
    return { success: false, error: errorMsg };
  }
}

/**
 * Persists a new named filter segment configuration for a blog site.
 *
 * @param {Object} params - Segment parameters.
 * @param {string} params.siteId - Blog site identifier.
 * @param {string} params.name - User-provided segment title.
 * @param {string} params.filtersJson - Stringified JSON containing criteria parameters.
 * @returns {Promise<AnalyticsMutationResponse<{ id: string }>>} Operation outcome with created segment ID.
 */
export async function createSegmentAction(params: {
  siteId: string;
  name: string;
  filtersJson: string;
}): Promise<AnalyticsMutationResponse<{ id: string }>> {
  await requireAuth(["super_admin", "admin", "editor"]);

  const { siteId, name, filtersJson } = params;
  if (!siteId || !name?.trim()) {
    return { success: false, error: "Segment name and site ID are required" };
  }

  try {
    const db = getDb();
    const id = `seg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    db.insert(analyticsSegments)
      .values({
        id,
        siteId,
        name: name.trim(),
        filters: filtersJson || "{}",
        createdAt: new Date(),
      })
      .run();

    revalidatePath("/admin/analytics/segments");
    return { success: true, data: { id } };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create segment";
    return { success: false, error: errorMsg };
  }
}

/**
 * Removes a saved filter segment definition from the database.
 *
 * @param {string} segmentId - Database identifier of the segment to remove.
 * @returns {Promise<AnalyticsMutationResponse>} Operation status.
 */
export async function deleteSegmentAction(segmentId: string): Promise<AnalyticsMutationResponse> {
  await requireAuth(["super_admin", "admin", "editor"]);

  if (!segmentId) {
    return { success: false, error: "Missing segment ID" };
  }

  try {
    const db = getDb();
    db.delete(analyticsSegments).where(eq(analyticsSegments.id, segmentId)).run();

    revalidatePath("/admin/analytics/segments");
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete segment";
    return { success: false, error: errorMsg };
  }
}

export { type RealtimeFeedItem, type RealtimeDataResponse } from "@/lib/analytics/realtime";
import { getRealtimeFeedData, type RealtimeDataResponse } from "@/lib/analytics/realtime";

/**
 * Retrieves the latest stream of pageviews and concurrent visitors active within the preceding 5 minutes.
 *
 * @param {string} siteId - Target blog site unique identifier.
 * @returns {Promise<AnalyticsMutationResponse<RealtimeDataResponse>>} Current live activity data.
 */
export async function getRealtimeFeedAction(siteId: string): Promise<AnalyticsMutationResponse<RealtimeDataResponse>> {
  await requireAuth(["super_admin", "admin", "editor", "author"]);

  if (!siteId) {
    return { success: false, error: "Missing site ID" };
  }

  try {
    const data = await getRealtimeFeedData(siteId);
    return {
      success: true,
      data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch realtime feed";
    return { success: false, error: errorMsg };
  }
}
