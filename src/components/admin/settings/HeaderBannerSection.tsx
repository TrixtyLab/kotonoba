"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  Sparkles,
  Calendar,
  Clock,
} from "lucide-react";
import { normalizeMediaUrl } from "@/lib/utils/media";

/** Props for {@link HeaderBannerSection}. */
export interface HeaderBannerSectionProps {
  defaultImage: string;
  onChangeDefaultImage: (v: string) => void;
  defaultLink: string;
  onChangeDefaultLink: (v: string) => void;
  defaultTarget: "_blank" | "_self";
  onChangeDefaultTarget: (v: "_blank" | "_self") => void;
  defaultAlt: string;
  onChangeDefaultAlt: (v: string) => void;
  scheduleEnabled: boolean;
  onChangeScheduleEnabled: (v: boolean) => void;
  scheduledImage: string;
  onChangeScheduledImage: (v: string) => void;
  scheduledLink: string;
  onChangeScheduledLink: (v: string) => void;
  scheduledTarget: "_blank" | "_self";
  onChangeScheduledTarget: (v: "_blank" | "_self") => void;
  scheduledAlt: string;
  onChangeScheduledAlt: (v: string) => void;
  startDate: string;
  onChangeStartDate: (v: string) => void;
  endDate: string;
  onChangeEndDate: (v: string) => void;
  campaignStatus: "disabled" | "scheduled" | "expired" | "active";
  onOpenMediaPickerDefault: () => void;
  onOpenMediaPickerScheduled: () => void;
}

/**
 * Configuration cards for the permanent default header banner and temporary scheduled campaign banner.
 */
export function HeaderBannerSection({
  defaultImage,
  onChangeDefaultImage,
  defaultLink,
  onChangeDefaultLink,
  defaultTarget,
  onChangeDefaultTarget,
  defaultAlt,
  onChangeDefaultAlt,
  scheduleEnabled,
  onChangeScheduleEnabled,
  scheduledImage,
  onChangeScheduledImage,
  scheduledLink,
  onChangeScheduledLink,
  scheduledTarget,
  onChangeScheduledTarget,
  scheduledAlt,
  onChangeScheduledAlt,
  startDate,
  onChangeStartDate,
  endDate,
  onChangeEndDate,
  campaignStatus,
  onOpenMediaPickerDefault,
  onOpenMediaPickerScheduled,
}: HeaderBannerSectionProps) {
  const t = useTranslations("settings");

  return (
    <>
      <section className="space-y-6 p-5 sm:p-6 rounded-xl border border-border/60 bg-surface/40">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>{t("defaultHeaderBanner")}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{t("defaultHeaderBannerDesc")}</p>
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
              <span className="text-xs text-text-muted font-mono">1200 × 302 px</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenMediaPickerDefault}
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
                    onChangeDefaultImage("");
                    onChangeDefaultLink("");
                    onChangeDefaultAlt("");
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
              onClick={onOpenMediaPickerDefault}
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
              onChange={(e) => onChangeDefaultLink(e.target.value)}
              placeholder="https://example.com o /entry/my-post"
              className="text-xs"
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-text">{t("bannerAltText")}</label>
            <Input
              type="text"
              value={defaultAlt}
              onChange={(e) => onChangeDefaultAlt(e.target.value)}
              placeholder={t("mainBannerPlaceholder")}
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
              onChange={(e) => onChangeDefaultTarget(e.target.checked ? "_blank" : "_self")}
              className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="defaultTargetCheckbox"
              className="text-xs text-text select-none cursor-pointer flex items-center gap-1"
            >
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
            <p className="text-xs text-text-muted mt-0.5">{t("scheduledCampaignDesc")}</p>
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
            onChange={(e) => onChangeScheduleEnabled(e.target.checked)}
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
                  <span className="text-xs text-text-muted font-mono">1200 × 302 px</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenMediaPickerScheduled}
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
                        onChangeScheduledImage("");
                        onChangeScheduledLink("");
                        onChangeScheduledAlt("");
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
                  onClick={onOpenMediaPickerScheduled}
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
                  onChange={(e) => onChangeScheduledLink(e.target.value)}
                  placeholder="https://example.com/promo o /entry/event-announcement"
                  className="text-xs"
                />
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-text">{t("bannerAltText")}</label>
                <Input
                  type="text"
                  value={scheduledAlt}
                  onChange={(e) => onChangeScheduledAlt(e.target.value)}
                  placeholder={t("bannerSummerPlaceholder")}
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
                  onChange={(e) => onChangeScheduledTarget(e.target.checked ? "_blank" : "_self")}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="scheduledTargetCheckbox"
                  className="text-xs text-text select-none cursor-pointer flex items-center gap-1"
                >
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
                  onChange={(e) => onChangeStartDate(e.target.value)}
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
                  onChange={(e) => onChangeEndDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
