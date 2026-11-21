import { and, eq } from "drizzle-orm";
import { analytics, analyticsSegments, pages, posts, settings } from "@/lib/db/schema";
import { SECRET_SETTING_KEYS } from "@/lib/config/settings-keys";
import { encryptSecret, isEncryptedSecret } from "@/lib/security/crypto";
import { generateId } from "@/lib/utils/slug";
import type { DbTx } from "./db-restore";
import type { BackupData, RestoreStats } from "./types";

/** Upserts backed-up site settings while ensuring sensitive tokens are encrypted at rest. */
export function restoreSiteSettingsRows(
  tx: DbTx,
  targetSiteId: string,
  rawSettings: BackupData["settings"],
  stats: RestoreStats
): void {
  for (const s of Array.isArray(rawSettings) ? rawSettings : []) {
    if (!s.key) continue;
    let storedValue = s.value || "";
    if (SECRET_SETTING_KEYS.has(s.key) && storedValue && !isEncryptedSecret(storedValue)) {
      storedValue = encryptSecret(storedValue);
    }
    const existing = tx.select().from(settings).where(and(eq(settings.siteId, targetSiteId), eq(settings.key, s.key))).get();
    if (existing) tx.update(settings).set({ value: storedValue }).where(eq(settings.id, existing.id)).run();
    else tx.insert(settings).values({ siteId: targetSiteId, key: s.key, value: storedValue }).run();
    stats.settings++;
  }
}

/** Restores named analytics filter segments scoped to the target tenant site. */
export function restoreAnalyticsSegmentsRows(
  tx: DbTx,
  targetSiteId: string,
  rawSegments: BackupData["analyticsSegments"],
  stats: RestoreStats
): void {
  for (const seg of Array.isArray(rawSegments) ? rawSegments : []) {
    if (!seg.name) continue;
    const existingSeg = tx
      .select()
      .from(analyticsSegments)
      .where(and(eq(analyticsSegments.siteId, targetSiteId), eq(analyticsSegments.name, seg.name)))
      .get();
    if (existingSeg) {
      tx.update(analyticsSegments).set({ filters: seg.filters || "{}" }).where(eq(analyticsSegments.id, existingSeg.id)).run();
    } else {
      const existingById = seg.id
        ? tx.select({ id: analyticsSegments.id }).from(analyticsSegments).where(eq(analyticsSegments.id, seg.id)).get()
        : null;
      const targetSegId = seg.id && !existingById ? seg.id : generateId();
      tx.insert(analyticsSegments)
        .values({
          id: targetSegId,
          siteId: targetSiteId,
          name: seg.name,
          filters: seg.filters || "{}",
          createdAt: seg.createdAt ? new Date(seg.createdAt) : new Date(),
        })
        .run();
    }
    stats.analyticsSegments++;
  }
}

function resolveHitTargetId(mappedId: string | null, checkExists: (candidate: string) => boolean): string | null {
  return mappedId && checkExists(mappedId) ? mappedId : null;
}

function buildHitClientFields(hit: NonNullable<BackupData["analytics"]>[number]) {
  return {
    referrer: hit.referrer ?? undefined,
    userAgent: hit.userAgent ?? "",
    ipHash: hit.ipHash ?? "backup_hash",
    country: hit.country ?? undefined,
    city: hit.city ?? undefined,
    device: hit.device ?? "desktop",
    browser: hit.browser ?? undefined,
    os: hit.os ?? undefined,
    language: hit.language ?? undefined,
    sessionId: hit.sessionId ?? undefined,
  };
}

function buildHitTelemetryFields(hit: NonNullable<BackupData["analytics"]>[number]) {
  return {
    loadTime: hit.loadTime ?? undefined,
    timeOnPage: hit.timeOnPage ?? 0,
    screenWidth: hit.screenWidth ?? undefined,
    screenHeight: hit.screenHeight ?? undefined,
    utmSource: hit.utmSource ?? undefined,
    utmMedium: hit.utmMedium ?? undefined,
    utmCampaign: hit.utmCampaign ?? undefined,
    utmTerm: hit.utmTerm ?? undefined,
    utmContent: hit.utmContent ?? undefined,
  };
}

function restoreSingleAnalyticsHit(
  tx: DbTx,
  targetSiteId: string,
  hit: NonNullable<BackupData["analytics"]>[number],
  postIdMap: Map<string, string>,
  pageIdMap: Map<string, string>
): boolean {
  if (!hit.path) return false;
  const rawPostId = hit.postId ? postIdMap.get(hit.postId) || hit.postId : null;
  const rawPageId = hit.pageId ? pageIdMap.get(hit.pageId) || hit.pageId : null;
  const validPostId = resolveHitTargetId(rawPostId, (id) =>
    Boolean(tx.select({ id: posts.id }).from(posts).where(and(eq(posts.id, id), eq(posts.siteId, targetSiteId))).get())
  );
  const validPageId = resolveHitTargetId(rawPageId, (id) =>
    Boolean(tx.select({ id: pages.id }).from(pages).where(and(eq(pages.id, id), eq(pages.siteId, targetSiteId))).get())
  );

  try {
    tx.insert(analytics)
      .values({
        siteId: targetSiteId,
        postId: validPostId,
        pageId: validPageId,
        path: hit.path,
        ...buildHitClientFields(hit),
        ...buildHitTelemetryFields(hit),
        createdAt: hit.createdAt ? new Date(hit.createdAt) : new Date(),
      })
      .run();
    return true;
  } catch {
    return false;
  }
}

/** Inserts re-mapped historical analytics pageviews for restored tenant posts and pages. */
export function restoreAnalyticsHitRows(
  tx: DbTx,
  targetSiteId: string,
  rawHits: BackupData["analytics"],
  postIdMap: Map<string, string>,
  pageIdMap: Map<string, string>,
  stats: RestoreStats
): void {
  const hits = Array.isArray(rawHits) ? rawHits : [];
  for (const hit of hits) {
    if (restoreSingleAnalyticsHit(tx, targetSiteId, hit, postIdMap, pageIdMap)) stats.analytics++;
  }
}
