"use server";

import { getDb } from "@/lib/db";
import { analytics, posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

/**
 * Result payload returned from analytics reset operations.
 */
export type AnalyticsMutationResponse =
  | { success: true }
  | { success: false; error: string };

/**
 * Purges all historical traffic records, device analytics, and reset post view counters for a specific blog site.
 *
 * @param siteId - Target blog site unique database identifier.
 * @returns A Promise resolving to an AnalyticsMutationResponse object.
 * @throws {Error} If the authenticated session lacks super_admin or admin authorization.
 */
export async function resetAnalyticsAction(siteId: string): Promise<AnalyticsMutationResponse> {
  await requireAuth(["super_admin", "admin"]);

  if (!siteId || typeof siteId !== "string") {
    return { success: false, error: "Invalid site ID" };
  }

  try {
    const db = getDb();

    // 1. Delete all traffic and beacon records associated with the site
    db.delete(analytics).where(eq(analytics.siteId, siteId)).run();

    // 2. Reset view metrics on all posts for this site
    db.update(posts).set({ views: 0 }).where(eq(posts.siteId, siteId)).run();

    revalidatePath("/admin/analytics");
    revalidatePath("/admin");
    revalidatePath("/admin/posts");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset analytics";
    return { success: false, error: errorMsg };
  }
}
