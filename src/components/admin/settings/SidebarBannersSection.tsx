"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import type { SidebarBannerItem } from "@/lib/banners";
import { normalizeMediaUrl } from "@/lib/utils/media";

/** Props for {@link SidebarBannersSection}. */
export interface SidebarBannersSectionProps {
  banners: SidebarBannerItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onUpdateField: (index: number, field: keyof SidebarBannerItem, value: string) => void;
  onOpenMediaPicker: (index: number) => void;
}

/**
 * Repeatable sidebar mini-banner management list with ordering and media selection triggers.
 */
export function SidebarBannersSection({
  banners,
  onAdd,
  onRemove,
  onMove,
  onUpdateField,
  onOpenMediaPicker,
}: SidebarBannersSectionProps) {
  const t = useTranslations("settings");

  return (
    <section className="space-y-5 p-5 sm:p-6 rounded-xl border border-border/60 bg-surface/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-accent" />
            <span>{t("sidebarBanners")}</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{t("sidebarBannersDesc")}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="self-start sm:self-auto flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-accent" />
          <span>{t("addSidebarBanner")}</span>
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-lg">
          <ImageIcon className="w-8 h-8 text-text-muted/40 mx-auto" />
          <p className="text-xs text-text-muted">{t("noSidebarBanners")}</p>
          <Button type="button" variant="outline" size="sm" onClick={onAdd} className="text-xs mt-2">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>{t("addSidebarBanner")}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="p-4 rounded-lg border border-border/60 bg-surface space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30 text-xs">
                <span className="font-semibold text-text">
                  {t("miniBanner", { index: index + 1 })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMove(index, "up")}
                    className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-30"
                    title={t("moveUp")}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === banners.length - 1}
                    onClick={() => onMove(index, "down")}
                    className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover disabled:opacity-30"
                    title={t("moveDown")}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="p-1 rounded text-danger hover:bg-danger/10 ml-2"
                    title={t("deleteBanner")}
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
                    onClick={() => onOpenMediaPicker(index)}
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
                      onChange={(e) => onUpdateField(index, "linkUrl", e.target.value)}
                      placeholder="https://example.com/item o /category/games"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text">{t("bannerAltText")}</label>
                    <Input
                      type="text"
                      value={banner.alt || ""}
                      onChange={(e) => onUpdateField(index, "alt", e.target.value)}
                      placeholder={t("bannerPlaceholder")}
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
                          onUpdateField(index, "target", e.target.checked ? "_blank" : "_self")
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
  );
}
