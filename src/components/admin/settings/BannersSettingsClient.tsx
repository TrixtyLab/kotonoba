"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Save,
  Sparkles,
  Calendar,
  Clock,
} from "lucide-react";
import type { SiteBannersConfig, SidebarBannerItem } from "@/lib/banners";
import { generateId } from "@/lib/utils/slug";
import { normalizeMediaUrl } from "@/lib/utils/media";

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
export function BannersSettingsClient({
  siteId,
  initialBanners,
}: BannersSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [defaultImage, setDefaultImage] = useState(
    initialBanners.headerBanner?.defaultBanner?.imageUrl || ""
  );
  const [defaultLink, setDefaultLink] = useState(
    initialBanners.headerBanner?.defaultBanner?.linkUrl || ""
  );
  const [defaultTarget, setDefaultTarget] = useState<"_blank" | "_self">(
    initialBanners.headerBanner?.defaultBanner?.target || "_blank"
  );
  const [defaultAlt, setDefaultAlt] = useState(
    initialBanners.headerBanner?.defaultBanner?.alt || ""
  );

  const [scheduleEnabled, setScheduleEnabled] = useState(
    initialBanners.headerBanner?.scheduleEnabled || false
  );
  const [scheduledImage, setScheduledImage] = useState(
    initialBanners.headerBanner?.scheduledCampaign?.imageUrl || ""
  );
  const [scheduledLink, setScheduledLink] = useState(
    initialBanners.headerBanner?.scheduledCampaign?.linkUrl || ""
  );
  const [scheduledTarget, setScheduledTarget] = useState<"_blank" | "_self">(
    initialBanners.headerBanner?.scheduledCampaign?.target || "_blank"
  );
  const [scheduledAlt, setScheduledAlt] = useState(
    initialBanners.headerBanner?.scheduledCampaign?.alt || ""
  );
  const [startDate, setStartDate] = useState(
    initialBanners.headerBanner?.scheduledCampaign?.startDate || ""
  );
  const [endDate, setEndDate] = useState(
    initialBanners.headerBanner?.scheduledCampaign?.endDate || ""
  );

  const [sidebarBanners, setSidebarBanners] = useState<SidebarBannerItem[]>(
    initialBanners.sidebarBanners || []
  );

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    | { type: "defaultHeader" }
    | { type: "scheduledHeader" }
    | { type: "sidebar"; index: number }
    | null
  >(null);

  const campaignStatus = React.useMemo(() => {
    if (!scheduleEnabled) return "disabled";
    const now = Date.now();
    if (startDate && startDate.trim()) {
      const start = new Date(startDate).getTime();
      if (!isNaN(start) && now < start) return "scheduled";
    }
    if (endDate && endDate.trim()) {
      const end = new Date(endDate).getTime();
      if (!isNaN(end) && now > end) return "expired";
    }
    return "active";
  }, [scheduleEnabled, startDate, endDate]);

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
  function handleSave(e: React.FormEvent): void {
    e.preventDefault();

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
    <form onSubmit={handleSave} className="space-y-10">
      <div>
        <h2 className="text-lg font-bold text-text tracking-tight flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-accent" />
          <span>{t("banners")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-1">
          {t("bannersDesc")}
        </p>
      </div>

      <section className="space-y-6 p-5 sm:p-6 rounded-xl border border-border/60 bg-surface/40">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>{t("defaultHeaderBanner")}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {t("defaultHeaderBannerDesc")}
          </p>
        </div>

        {defaultImage ? (
          <div className="space-y-3">
            <div className="relative w-full h-[180px] sm:h-[220px] md:h-[302px] rounded-xl overflow-hidden border border-border/60 bg-surface-hover/20 shadow-xs">
              <img
                src={normalizeMediaUrl(defaultImage)}
                alt={defaultAlt || "Default Header Banner Preview"}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-text-muted font-mono">
                1200 × 302 px
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openMediaPickerForDefaultHeader}
                  className="text-xs flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent" />
                  <span>{t("changeImage")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDefaultImage("");
                    setDefaultLink("");
                    setDefaultAlt("");
                  }}
                  className="text-xs text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t("removeBanner")}</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-44 rounded-xl border-2 border-dashed border-border/70 flex flex-col items-center justify-center p-6 text-center text-text-muted space-y-3">
            <div className="w-10 h-10 rounded-full bg-surface-hover/80 flex items-center justify-center text-text-muted">
              <ImageIcon className="w-5 h-5 text-text-muted/60" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text">{t("noBannersConfigured")}</p>
              <p className="text-[11px] text-text-muted font-mono">1200 × 302 px</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openMediaPickerForDefaultHeader}
              className="flex items-center gap-1.5 text-xs mt-1"
            >
              <ImageIcon className="w-3.5 h-3.5 text-accent" />
              <span>{t("selectFromMedia")}</span>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 space-y-1.5">
            <label className="text-xs font-semibold text-text flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-text-muted" />
              <span>{t("bannerLinkUrl")}</span>
            </label>
            <Input
              type="text"
              value={defaultLink}
              onChange={(e) => setDefaultLink(e.target.value)}
              placeholder="https://example.com o /entry/my-post"
              className="text-xs"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-text">
              {t("bannerAltText")}
            </label>
            <Input
              type="text"
              value={defaultAlt}
              onChange={(e) => setDefaultAlt(e.target.value)}
              placeholder="e.g. Kotonoba Main Banner"
              className="text-xs"
            />
          </div>
        </div>

        {defaultLink && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="defaultTargetCheckbox"
              checked={defaultTarget === "_blank"}
              onChange={(e) => setDefaultTarget(e.target.checked ? "_blank" : "_self")}
              className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
            />
            <label htmlFor="defaultTargetCheckbox" className="text-xs text-text select-none cursor-pointer flex items-center gap-1">
              <span>{t("openInNewTab")}</span>
              <ExternalLink className="w-3 h-3 text-text-muted" />
            </label>
          </div>
        )}
      </section>

      <section className="space-y-6 p-5 sm:p-6 rounded-xl border border-border/60 bg-surface/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span>{t("scheduledCampaign")}</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t("scheduledCampaignDesc")}
            </p>
          </div>

          {scheduleEnabled && scheduledImage && (
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border whitespace-nowrap shrink-0 self-start sm:self-auto ${
                campaignStatus === "active"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : campaignStatus === "scheduled"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  campaignStatus === "active"
                    ? "bg-emerald-500 animate-pulse"
                    : campaignStatus === "scheduled"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span>
                {campaignStatus === "active"
                  ? t("campaignActiveBadge")
                  : campaignStatus === "scheduled"
                  ? t("campaignScheduledBadge")
                  : t("campaignExpiredBadge")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-surface">
          <div className="space-y-0.5">
            <label htmlFor="enableCampaignToggle" className="text-xs font-bold text-text cursor-pointer">
              {t("enableScheduledCampaign")}
            </label>
            <p className="text-[11px] text-text-muted">
              {scheduleEnabled
                ? t("bannerScheduleHint")
                : "Active when you have a temporary event, release, or promotion."}
            </p>
          </div>

          <input
            type="checkbox"
            id="enableCampaignToggle"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
          />
        </div>

        {scheduleEnabled && (
          <div className="space-y-5 animate-fade-in pt-2">
            {scheduledImage ? (
              <div className="space-y-3">
                <div className="relative w-full h-[180px] sm:h-[220px] md:h-[302px] rounded-xl overflow-hidden border border-border/60 bg-surface-hover/20 shadow-xs">
                  <img
                    src={normalizeMediaUrl(scheduledImage)}
                    alt={scheduledAlt || "Scheduled Campaign Banner Preview"}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-text-muted font-mono">
                    1200 × 302 px
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openMediaPickerForScheduledHeader}
                      className="text-xs flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-accent" />
                      <span>{t("changeImage")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setScheduledImage("");
                        setScheduledLink("");
                        setScheduledAlt("");
                      }}
                      className="text-xs text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("removeBanner")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-44 rounded-xl border-2 border-dashed border-border/70 flex flex-col items-center justify-center p-6 text-center text-text-muted space-y-3">
                <div className="w-10 h-10 rounded-full bg-surface-hover/80 flex items-center justify-center text-text-muted">
                  <ImageIcon className="w-5 h-5 text-text-muted/60" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-text">{t("noScheduledBannerConfigured")}</p>
                  <p className="text-[11px] text-text-muted font-mono">1200 × 302 px</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openMediaPickerForScheduledHeader}
                  className="flex items-center gap-1.5 text-xs mt-1"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent" />
                  <span>{t("selectFromMedia")}</span>
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-text-muted" />
                  <span>{t("bannerLinkUrl")}</span>
                </label>
                <Input
                  type="text"
                  value={scheduledLink}
                  onChange={(e) => setScheduledLink(e.target.value)}
                  placeholder="https://example.com/promo o /entry/event-announcement"
                  className="text-xs"
                />
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-text">
                  {t("bannerAltText")}
                </label>
                <Input
                  type="text"
                  value={scheduledAlt}
                  onChange={(e) => setScheduledAlt(e.target.value)}
                  placeholder="e.g. Summer Festival 2026"
                  className="text-xs"
                />
              </div>
            </div>

            {scheduledLink && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="scheduledTargetCheckbox"
                  checked={scheduledTarget === "_blank"}
                  onChange={(e) => setScheduledTarget(e.target.checked ? "_blank" : "_self")}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                />
                <label htmlFor="scheduledTargetCheckbox" className="text-xs text-text select-none cursor-pointer flex items-center gap-1">
                  <span>{t("openInNewTab")}</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-surface border border-border/60">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <span>{t("bannerStartDate")}</span>
                </label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <span>{t("bannerEndDate")}</span>
                </label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-5 p-5 sm:p-6 rounded-xl border border-border/60 bg-surface/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" />
              <span>{t("sidebarBanners")}</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t("sidebarBannersDesc")}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSidebarBanner}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-accent" />
            <span>{t("addSidebarBanner")}</span>
          </Button>
        </div>

        {sidebarBanners.length === 0 ? (
          <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-lg">
            <ImageIcon className="w-8 h-8 text-text-muted/40 mx-auto" />
            <p className="text-xs text-text-muted">{t("noSidebarBanners")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSidebarBanner}
              className="text-xs mt-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>{t("addSidebarBanner")}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sidebarBanners.map((banner, index) => (
              <div
                key={banner.id}
                className="p-4 rounded-lg border border-border/60 bg-surface space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30 text-xs">
                  <span className="font-semibold text-text">
                    #{index + 1} Mini Banner
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSidebarBanner(index, "up")}
                      className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sidebarBanners.length - 1}
                      onClick={() => moveSidebarBanner(index, "down")}
                      className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSidebarBanner(index)}
                      className="p-1 rounded text-danger hover:bg-danger/10 ml-2"
                      title="Delete mini banner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-4 space-y-2">
                    {banner.imageUrl ? (
                      <div className="w-full aspect-16/9 rounded-lg overflow-hidden border border-border/60 bg-surface-hover/20">
                        <img
                          src={normalizeMediaUrl(banner.imageUrl)}
                          alt={banner.alt || "Sidebar Banner Preview"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-16/9 rounded-lg border-2 border-dashed border-border/70 flex items-center justify-center text-text-muted/40">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openMediaPickerForSidebar(index)}
                      className="w-full text-xs flex items-center justify-center gap-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-accent" />
                      <span>{banner.imageUrl ? t("changeImage") : t("selectFromMedia")}</span>
                    </Button>
                  </div>

                  <div className="md:col-span-8 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-text-muted" />
                        <span>{t("bannerLinkUrl")}</span>
                      </label>
                      <Input
                        type="text"
                        value={banner.linkUrl || ""}
                        onChange={(e) =>
                          updateSidebarBannerField(index, "linkUrl", e.target.value)
                        }
                        placeholder="https://example.com/item o /category/games"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text">
                        {t("bannerAltText")}
                      </label>
                      <Input
                        type="text"
                        value={banner.alt || ""}
                        onChange={(e) =>
                          updateSidebarBannerField(index, "alt", e.target.value)
                        }
                        placeholder="e.g. Special Discount 50% Off"
                        className="text-xs"
                      />
                    </div>

                    {banner.linkUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id={`sidebarTarget_${banner.id}`}
                          checked={banner.target !== "_self"}
                          onChange={(e) =>
                            updateSidebarBannerField(
                              index,
                              "target",
                              e.target.checked ? "_blank" : "_self"
                            )
                          }
                          className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer"
                        />
                        <label
                          htmlFor={`sidebarTarget_${banner.id}`}
                          className="text-xs text-text select-none cursor-pointer flex items-center gap-1"
                        >
                          <span>{t("openInNewTab")}</span>
                          <ExternalLink className="w-3 h-3 text-text-muted" />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-6"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{tc("saving")}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{tc("saveChanges")}</span>
            </>
          )}
        </Button>
      </div>

      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => {
          setMediaPickerOpen(false);
          setMediaPickerTarget(null);
        }}
        onSelect={handleMediaSelect}
      />
    </form>
  );
}
