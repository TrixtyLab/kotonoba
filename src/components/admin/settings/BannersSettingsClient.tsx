"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { HeaderBannerSection } from "@/components/admin/settings/HeaderBannerSection";
import { SidebarBannersSection } from "@/components/admin/settings/SidebarBannersSection";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { useToast } from "@/components/ui/Toast";
import { Image as ImageIcon } from "lucide-react";
import type { SiteBannersConfig, SidebarBannerItem } from "@/lib/banners";
import { generateId } from "@/lib/utils/slug";

/**
 * Properties configuring the BannersSettingsClient component.
 */
export interface BannersSettingsClientProps {
  /** Target site database identifier. */
  siteId: string;
  /** Initial banner settings loaded from database. */
  initialBanners: SiteBannersConfig;
}

/**
 * Administrative settings interface for configuring full-width header banners,
 * temporary scheduled campaigns with automatic fallback, and sidebar promotional mini-banners.
 *
 * @param {BannersSettingsClientProps} props - Component properties configuring site ID and initial banner states.
 * @returns {React.JSX.Element} React JSX banner settings management form.
 */
function extractDefaultHeaderDefaults(def: NonNullable<SiteBannersConfig["headerBanner"]>["defaultBanner"]) {
  return {
    defaultImage: def?.imageUrl || "",
    defaultLink: def?.linkUrl || "",
    defaultTarget: def?.target || ("_blank" as const),
    defaultAlt: def?.alt || "",
  };
}

function extractScheduledHeaderDefaults(sched: NonNullable<SiteBannersConfig["headerBanner"]>["scheduledCampaign"]) {
  return {
    scheduledImage: sched?.imageUrl || "",
    scheduledLink: sched?.linkUrl || "",
    scheduledTarget: sched?.target || ("_blank" as const),
    scheduledAlt: sched?.alt || "",
    startDate: sched?.startDate || "",
    endDate: sched?.endDate || "",
  };
}

function extractInitialBannerDefaults(initialBanners: SiteBannersConfig) {
  return {
    ...extractDefaultHeaderDefaults(initialBanners.headerBanner?.defaultBanner ?? null),
    ...extractScheduledHeaderDefaults(initialBanners.headerBanner?.scheduledCampaign ?? null),
    scheduleEnabled: Boolean(initialBanners.headerBanner?.scheduleEnabled),
    sidebarBanners: initialBanners.sidebarBanners || [],
  };
}

function resolveCampaignStatus(scheduleEnabled: boolean, startDate: string, endDate: string, nowMs: number) {
  if (!scheduleEnabled) return "disabled" as const;
  if (startDate.trim()) {
    const start = new Date(startDate).getTime();
    if (!isNaN(start) && nowMs < start) return "scheduled" as const;
  }
  if (endDate.trim()) {
    const end = new Date(endDate).getTime();
    if (!isNaN(end) && nowMs > end) return "expired" as const;
  }
  return "active" as const;
}

export function BannersSettingsClient({
  siteId,
  initialBanners,
}: BannersSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const defaults = React.useMemo(() => extractInitialBannerDefaults(initialBanners), [initialBanners]);

  const [defaultImage, setDefaultImage] = useState(defaults.defaultImage);
  const [defaultLink, setDefaultLink] = useState(defaults.defaultLink);
  const [defaultTarget, setDefaultTarget] = useState<"_blank" | "_self">(defaults.defaultTarget);
  const [defaultAlt, setDefaultAlt] = useState(defaults.defaultAlt);

  const [scheduleEnabled, setScheduleEnabled] = useState(defaults.scheduleEnabled);
  const [scheduledImage, setScheduledImage] = useState(defaults.scheduledImage);
  const [scheduledLink, setScheduledLink] = useState(defaults.scheduledLink);
  const [scheduledTarget, setScheduledTarget] = useState<"_blank" | "_self">(defaults.scheduledTarget);
  const [scheduledAlt, setScheduledAlt] = useState(defaults.scheduledAlt);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const [sidebarBanners, setSidebarBanners] = useState<SidebarBannerItem[]>(defaults.sidebarBanners);

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    | { type: "defaultHeader" }
    | { type: "scheduledHeader" }
    | { type: "sidebar"; index: number }
    | null
  >(null);

  const [referenceNowMs] = useState(() => Date.now());
  const campaignStatus = React.useMemo(
    () => resolveCampaignStatus(scheduleEnabled, startDate, endDate, referenceNowMs),
    [scheduleEnabled, startDate, endDate, referenceNowMs]
  );

  /**
   * Opens the media library modal to select an image for the permanent default header banner.
   *
   * @returns {void}
   */
  function openMediaPickerForDefaultHeader(): void {
    setMediaPickerTarget({ type: "defaultHeader" });
    setMediaPickerOpen(true);
  }

  /**
   * Opens the media library modal to select an image for the scheduled campaign header banner.
   *
   * @returns {void}
   */
  function openMediaPickerForScheduledHeader(): void {
    setMediaPickerTarget({ type: "scheduledHeader" });
    setMediaPickerOpen(true);
  }

  /**
   * Opens the media library modal for a specific sidebar mini-banner.
   *
   * @param {number} index - Array index of the target sidebar mini-banner.
   * @returns {void}
   */
  function openMediaPickerForSidebar(index: number): void {
    setMediaPickerTarget({ type: "sidebar", index });
    setMediaPickerOpen(true);
  }

  /**
   * Assigns the selected media URL to the currently targeted banner state.
   *
   * @param {string} url - Chosen image asset URL from media library.
   * @returns {void}
   */
  function handleMediaSelect(url: string): void {
    if (!mediaPickerTarget) return;

    if (mediaPickerTarget.type === "defaultHeader") {
      setDefaultImage(url);
    } else if (mediaPickerTarget.type === "scheduledHeader") {
      setScheduledImage(url);
    } else if (mediaPickerTarget.type === "sidebar") {
      setSidebarBanners((prev) => {
        const copy = [...prev];
        if (copy[mediaPickerTarget.index]) {
          copy[mediaPickerTarget.index] = {
            ...copy[mediaPickerTarget.index],
            imageUrl: url,
          };
        }
        return copy;
      });
    }

    setMediaPickerOpen(false);
    setMediaPickerTarget(null);
  }

  /**
   * Appends a new blank mini-banner item to the sidebar banner list.
   *
   * @returns {void}
   */
  function addSidebarBanner(): void {
    const newItem: SidebarBannerItem = {
      id: generateId(),
      imageUrl: "",
      linkUrl: "",
      alt: "",
      target: "_blank",
    };
    setSidebarBanners((prev) => [...prev, newItem]);
  }

  /**
   * Removes a sidebar mini-banner at the specified array index.
   *
   * @param {number} index - Index of the item to delete.
   * @returns {void}
   */
  function removeSidebarBanner(index: number): void {
    setSidebarBanners((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Reorders a sidebar mini-banner item one position up or down.
   *
   * @param {number} index - Current index of the item.
   * @param {"up" | "down"} direction - Desired shift direction.
   * @returns {void}
   */
  function moveSidebarBanner(index: number, direction: "up" | "down"): void {
    setSidebarBanners((prev) => {
      const copy = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;

      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  /**
   * Updates an individual property of a specific sidebar mini-banner item.
   *
   * @param {number} index - Array index of the banner item.
   * @param {keyof SidebarBannerItem} field - Target property name to update.
   * @param {string} value - New value to assign.
   * @returns {void}
   */
  function updateSidebarBannerField(
    index: number,
    field: keyof SidebarBannerItem,
    value: string
  ): void {
    setSidebarBanners((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = {
          ...copy[index],
          [field]: value,
        };
      }
      return copy;
    });
  }

  /**
   * Persists all banner configurations to the database via server action.
   *
   * @param {React.FormEvent} e - Form submission event.
   * @returns {void}
   */
  function handleSave(): void {
    startTransition(async () => {
      const validSidebarBanners = sidebarBanners.filter(
        (b) => b.imageUrl && b.imageUrl.trim().length > 0
      );

      const payload: Record<string, string> = {
        header_banner_image: defaultImage.trim(),
        header_banner_link: defaultLink.trim(),
        header_banner_target: defaultTarget,
        header_banner_alt: defaultAlt.trim(),
        header_banner_schedule_enabled: scheduleEnabled ? "true" : "false",
        header_banner_scheduled_image: scheduledImage.trim(),
        header_banner_scheduled_link: scheduledLink.trim(),
        header_banner_scheduled_target: scheduledTarget,
        header_banner_scheduled_alt: scheduledAlt.trim(),
        header_banner_start_date: startDate.trim(),
        header_banner_end_date: endDate.trim(),
        sidebar_banners: JSON.stringify(validSidebarBanners),
      };

      const res = await saveSiteSettings(siteId, payload);
      if (res.success) {
        toast.success(t("bannersSaved"));
      } else {
        toast.error(res.error || tc("saveError"));
      }
    });
  }

  return (
    <SettingsForm
      title={t("banners")}
      description={t("bannersDesc")}
      icon={<ImageIcon className="w-5 h-5 text-accent" />}
      onSave={handleSave}
      saveLabel={isPending ? tc("saving") : tc("saveChanges")}
      isPending={isPending}
      maxWidthClass="max-w-4xl"
    >
      <HeaderBannerSection
        defaultImage={defaultImage}
        onChangeDefaultImage={setDefaultImage}
        defaultLink={defaultLink}
        onChangeDefaultLink={setDefaultLink}
        defaultTarget={defaultTarget}
        onChangeDefaultTarget={setDefaultTarget}
        defaultAlt={defaultAlt}
        onChangeDefaultAlt={setDefaultAlt}
        scheduleEnabled={scheduleEnabled}
        onChangeScheduleEnabled={setScheduleEnabled}
        scheduledImage={scheduledImage}
        onChangeScheduledImage={setScheduledImage}
        scheduledLink={scheduledLink}
        onChangeScheduledLink={setScheduledLink}
        scheduledTarget={scheduledTarget}
        onChangeScheduledTarget={setScheduledTarget}
        scheduledAlt={scheduledAlt}
        onChangeScheduledAlt={setScheduledAlt}
        startDate={startDate}
        onChangeStartDate={setStartDate}
        endDate={endDate}
        onChangeEndDate={setEndDate}
        campaignStatus={campaignStatus}
        onOpenMediaPickerDefault={openMediaPickerForDefaultHeader}
        onOpenMediaPickerScheduled={openMediaPickerForScheduledHeader}
      />

      <SidebarBannersSection
        banners={sidebarBanners}
        onAdd={addSidebarBanner}
        onRemove={removeSidebarBanner}
        onMove={moveSidebarBanner}
        onUpdateField={updateSidebarBannerField}
        onOpenMediaPicker={openMediaPickerForSidebar}
      />

      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => {
          setMediaPickerOpen(false);
          setMediaPickerTarget(null);
        }}
        onSelect={handleMediaSelect}
      />
    </SettingsForm>
  );
}
