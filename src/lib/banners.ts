import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";
import { sanitizeUrl } from "@/lib/security/sanitize";

/** Structure of an individual sidebar promotional mini-banner. */
export interface SidebarBannerItem {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  alt?: string;
  target?: "_blank" | "_self";
}

/** Individual banner asset definition with link and window target. */
export interface HeaderBannerItem {
  imageUrl: string | null;
  linkUrl: string | null;
  target: "_blank" | "_self";
  alt?: string;
}

/** Scheduled banner campaign with date constraints. */
export interface ScheduledBannerCampaign extends HeaderBannerItem {
  startDate?: string | null;
  endDate?: string | null;
}

/** Combined configuration for the top header banner system. */
export interface HeaderBannerConfig {
  defaultBanner: HeaderBannerItem | null;
  scheduledCampaign: ScheduledBannerCampaign | null;
  scheduleEnabled: boolean;
}

/** Combined banner configuration for a blog site. */
export interface SiteBannersConfig {
  headerBanner: HeaderBannerConfig | null;
  sidebarBanners: SidebarBannerItem[];
}

function isDateActive(startDate?: string | null, endDate?: string | null, now = Date.now()): boolean {
  if (startDate?.trim()) {
    const start = new Date(startDate).getTime();
    if (!isNaN(start) && now < start) return false;
  }
  if (endDate?.trim()) {
    const end = new Date(endDate).getTime();
    if (!isNaN(end) && now > end) return false;
  }
  return true;
}

/**
 * Resolves the currently active header banner for public presentation.
 */
export function getResolvedHeaderBanner(config: HeaderBannerConfig | null): HeaderBannerItem | null {
  if (!config) return null;

  const campaign = config.scheduledCampaign;
  if (config.scheduleEnabled && campaign?.imageUrl?.trim() && isDateActive(campaign.startDate, campaign.endDate)) {
    return campaign;
  }
  if (config.defaultBanner?.imageUrl?.trim()) return config.defaultBanner;
  return null;
}

function buildHeaderItemFromMap(map: Map<string, string>, prefix: string): HeaderBannerItem | null {
  const imageUrl = sanitizeUrl(map.get(`${prefix}_image`), { allowRelative: true });
  if (!imageUrl) return null;
  const target: "_blank" | "_self" = map.get(`${prefix}_target`) === "_self" ? "_self" : "_blank";
  return {
    imageUrl,
    linkUrl: sanitizeUrl(map.get(`${prefix}_link`), { allowRelative: true }),
    target,
    alt: map.get(`${prefix}_alt`)?.trim() || "",
  };
}

function parseSidebarBannersJson(rawSidebar?: string): SidebarBannerItem[] {
  if (!rawSidebar) return [];
  try {
    const parsed = JSON.parse(rawSidebar);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b): b is SidebarBannerItem => Boolean(b && typeof b.imageUrl === "string"))
      .map((b) => ({
        ...b,
        imageUrl: sanitizeUrl(b.imageUrl, { allowRelative: true }) || "",
        linkUrl: sanitizeUrl(b.linkUrl, { allowRelative: true }) || "",
      }))
      .filter((b) => b.imageUrl.length > 0);
  } catch {
    return [];
  }
}

/**
 * Retrieves uncached banner configurations for a site (used inside admin editor).
 */
export async function getSiteBanners(siteId: string): Promise<SiteBannersConfig> {
  try {
    const db = getDb();
    const siteSettings = db.select({ key: settings.key, value: settings.value }).from(settings).where(eq(settings.siteId, siteId)).all();
    const map = new Map(siteSettings.map((s) => [s.key, s.value]));

    const defaultBanner = buildHeaderItemFromMap(map, "header_banner");
    const scheduledBase = buildHeaderItemFromMap(map, "header_banner_scheduled");
    const scheduleEnabled = map.get("header_banner_schedule_enabled") === "true";

    const scheduledCampaign: ScheduledBannerCampaign | null = scheduledBase
      ? {
          ...scheduledBase,
          startDate: map.get("header_banner_start_date")?.trim() || null,
          endDate: map.get("header_banner_end_date")?.trim() || null,
        }
      : null;

    const headerBanner: HeaderBannerConfig | null =
      defaultBanner || scheduledCampaign || scheduleEnabled
        ? { defaultBanner, scheduledCampaign, scheduleEnabled }
        : null;

    return {
      headerBanner,
      sidebarBanners: parseSidebarBannersJson(map.get("sidebar_banners")),
    };
  } catch (err) {
    console.error("[banners] Failed to load site banners:", err);
    return { headerBanner: null, sidebarBanners: [] };
  }
}

/**
 * Retrieves tenant-cached header and sidebar banners keyed by `(siteId, host)`.
 */
export async function getCachedSiteBanners(
  siteId: string,
  host = "default"
): Promise<SiteBannersConfig> {
  return runWithTenantCache(
    async () => getSiteBanners(siteId),
    ["site-banners", siteId, host],
    {
      tags: [sitePostsCacheTag(siteId)],
      revalidate: 60,
    }
  );
}

/**
 * Retrieves tenant-cached sidebar promotional banners keyed by `(siteId, host)`.
 */
export async function getCachedSidebarBanners(
  siteId: string,
  host = "default"
): Promise<SidebarBannerItem[]> {
  const { sidebarBanners } = await getCachedSiteBanners(siteId, host);
  return sidebarBanners;
}
