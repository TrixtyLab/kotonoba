"use server";

import { getDb } from "@/lib/db";
import { analytics, posts, pages } from "@/lib/db/schema";
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

    revalidatePath("/admin/analytics");
    revalidatePath("/admin");
    revalidatePath("/admin/posts");
    revalidatePath("/admin/pages");

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reset analytics";
    return { success: false, error: errorMsg };
  }
}
