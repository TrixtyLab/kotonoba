import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Structure of an individual sidebar promotional mini-banner.
 */
export interface SidebarBannerItem {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  alt?: string;
  target?: "_blank" | "_self";
}

/**
 * Individual banner asset definition with link and window target.
 */
export interface HeaderBannerItem {
  imageUrl: string | null;
  linkUrl: string | null;
  target: "_blank" | "_self";
  alt?: string;
}

/**
 * Scheduled banner campaign with date constraints.
 */
export interface ScheduledBannerCampaign extends HeaderBannerItem {
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Combined configuration for the top header banner system.
 */
export interface HeaderBannerConfig {
  /** Default permanent fallback banner. */
  defaultBanner: HeaderBannerItem | null;
  /** Scheduled promotional campaign banner. */
  scheduledCampaign: ScheduledBannerCampaign | null;
  /** Flag determining if the scheduled campaign is active. */
  scheduleEnabled: boolean;
}

/**
 * Combined banner configuration for a blog site.
 */
export interface SiteBannersConfig {
  headerBanner: HeaderBannerConfig | null;
  sidebarBanners: SidebarBannerItem[];
}

/**
 * Resolves the currently active header banner for public presentation.
 * Evaluates whether a scheduled campaign is active at the current moment;
 * if not (or if expired/future), falls back seamlessly to the default permanent banner.
 *
 * @param {HeaderBannerConfig | null} config - Header banner configuration.
 * @returns {HeaderBannerItem | null} The resolved banner item to render, or null if none is active.
 */
export function getResolvedHeaderBanner(config: HeaderBannerConfig | null): HeaderBannerItem | null {
  if (!config) return null;

  if (config.scheduleEnabled && config.scheduledCampaign && config.scheduledCampaign.imageUrl?.trim()) {
    const now = Date.now();
    let isWithinSchedule = true;

    if (config.scheduledCampaign.startDate && config.scheduledCampaign.startDate.trim()) {
      const start = new Date(config.scheduledCampaign.startDate).getTime();
      if (!isNaN(start) && now < start) {
        isWithinSchedule = false;
      }
    }

    if (config.scheduledCampaign.endDate && config.scheduledCampaign.endDate.trim()) {
      const end = new Date(config.scheduledCampaign.endDate).getTime();
      if (!isNaN(end) && now > end) {
        isWithinSchedule = false;
      }
    }

    if (isWithinSchedule) {
      return config.scheduledCampaign;
    }
  }

  if (config.defaultBanner && config.defaultBanner.imageUrl?.trim()) {
    return config.defaultBanner;
  }

  return null;
}

/**
 * Retrieves all banner configurations for a specific site from the settings table.
 *
 * @param {string} siteId - Unique database identifier of the target site.
 * @returns {Promise<SiteBannersConfig>} Configuration object containing header banner and sidebar mini-banners.
 */
export async function getSiteBanners(siteId: string): Promise<SiteBannersConfig> {
  try {
    const db = getDb();
    const siteSettings = db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.siteId, siteId))
      .all();

    const map = new Map<string, string>();
    for (const s of siteSettings) {
      map.set(s.key, s.value);
    }

    const defaultImage = map.get("header_banner_image")?.trim() || null;
    const defaultLink = map.get("header_banner_link")?.trim() || null;
    const defaultTarget = (map.get("header_banner_target") === "_self" ? "_self" : "_blank") as "_blank" | "_self";
    const defaultAlt = map.get("header_banner_alt")?.trim() || "";

    const defaultBanner: HeaderBannerItem | null = defaultImage
      ? {
          imageUrl: defaultImage,
          linkUrl: defaultLink,
          target: defaultTarget,
          alt: defaultAlt,
        }
      : null;

    const scheduleEnabled = map.get("header_banner_schedule_enabled") === "true";
    const scheduledImage = map.get("header_banner_scheduled_image")?.trim() || null;
    const scheduledLink = map.get("header_banner_scheduled_link")?.trim() || null;
    const scheduledTarget = (map.get("header_banner_scheduled_target") === "_self" ? "_self" : "_blank") as "_blank" | "_self";
    const scheduledAlt = map.get("header_banner_scheduled_alt")?.trim() || "";
    const startDate = map.get("header_banner_start_date")?.trim() || null;
    const endDate = map.get("header_banner_end_date")?.trim() || null;

    const scheduledCampaign: ScheduledBannerCampaign | null = scheduledImage
      ? {
          imageUrl: scheduledImage,
          linkUrl: scheduledLink,
          target: scheduledTarget,
          alt: scheduledAlt,
          startDate,
          endDate,
        }
      : null;

    const headerBanner: HeaderBannerConfig | null =
      defaultBanner || scheduledCampaign || scheduleEnabled
        ? {
            defaultBanner,
            scheduledCampaign,
            scheduleEnabled,
          }
        : null;

    let sidebarBanners: SidebarBannerItem[] = [];
    const rawSidebar = map.get("sidebar_banners");
    if (rawSidebar) {
      try {
        const parsed = JSON.parse(rawSidebar);
        if (Array.isArray(parsed)) {
          sidebarBanners = parsed.filter((b) => b && typeof b.imageUrl === "string" && b.imageUrl.trim().length > 0);
        }
      } catch {
        sidebarBanners = [];
      }
    }

    return {
      headerBanner,
      sidebarBanners,
    };
  } catch (err) {
    console.error("[banners] Failed to load site banners:", err);
    return {
      headerBanner: null,
      sidebarBanners: [],
    };
  }
}

/**
 * Retrieves only the sidebar mini banners array for a specific site.
 *
 * @param {string} siteId - Unique database identifier of the target site.
 * @returns {Promise<SidebarBannerItem[]>} Array of configured sidebar mini banners.
 */
export async function getSidebarBanners(siteId: string): Promise<SidebarBannerItem[]> {
  const { sidebarBanners } = await getSiteBanners(siteId);
  return sidebarBanners;
}
