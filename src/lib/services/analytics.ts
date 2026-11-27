import { getDb } from "@/lib/db";
import { analytics, posts, pages, analyticsSegments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Purges analytics records and resets view counters for a tenant site. */
export function resetSiteAnalyticsService(siteId: string): void {
  const db = getDb();
  db.delete(analytics).where(eq(analytics.siteId, siteId)).run();
  db.update(posts).set({ views: 0 }).where(eq(posts.siteId, siteId)).run();
  db.update(pages).set({ views: 0 }).where(eq(pages.siteId, siteId)).run();
}

/** Creates a saved analytics filter segment for a tenant site. */
export function createAnalyticsSegmentService(siteId: string, name: string, filtersJson: string): string {
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
  return id;
}

/** Looks up the owning site ID of an analytics segment. */
export function getAnalyticsSegmentSiteId(segmentId: string): string | null {
  return (
    getDb()
      .select({ siteId: analyticsSegments.siteId })
      .from(analyticsSegments)
      .where(eq(analyticsSegments.id, segmentId))
      .get()?.siteId || null
  );
}

/** Removes an analytics filter segment by ID. */
export function deleteAnalyticsSegmentService(segmentId: string): void {
  getDb().delete(analyticsSegments).where(eq(analyticsSegments.id, segmentId)).run();
}
