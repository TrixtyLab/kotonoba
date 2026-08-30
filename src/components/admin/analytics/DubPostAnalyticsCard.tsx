"use client";

import React, { useState, useTransition } from "react";
import { Link2, QrCode, ExternalLink, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { generateDubLinkAction } from "@/actions/dub";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import type { DubLinkItem } from "@/lib/dub";

/**
 * Properties for the Dub.co post analytics and shortlink card component.
 */
export interface DubPostAnalyticsCardProps {
  /** Database identifier of the post. */
  postId: string;
  /** Primary domain hostname of the active blog site. */
  siteDomain: string;
  /** URL slug of the post. */
  slug: string;
  /** Title of the post. */
  title: string;
  /** Language locale code of the post. */
  locale: string;
  /** Existing shortened URL if already generated. */
  existingShortUrl: string | null;
  /** Real-time link item metrics fetched from the Dub.co API, or null if unlinked. */
  dubInfo: DubLinkItem | null;
}

/**
 * Interactive client card rendering Dub.co shortlink metrics, official dynamic QR code,
 * one-click clipboard copying, and on-demand shortlink generation.
 *
 * @param {DubPostAnalyticsCardProps} props - Component properties.
 * @returns {React.JSX.Element} React JSX card component.
 */
export function DubPostAnalyticsCard({
  postId,
  siteDomain,
  slug,
  title,
  locale,
  existingShortUrl,
  dubInfo,
}: DubPostAnalyticsCardProps) {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const toast = useToast();
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, startTransition] = useTransition();
  const [currentShortUrl, setCurrentShortUrl] = useState<string | null>(
    dubInfo?.shortLink || existingShortUrl
  );
  const [currentQr, setCurrentQr] = useState<string | null>(dubInfo?.qrCode || null);

  const cleanDomain = siteDomain.includes("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;
  const fullArticleUrl = `${cleanDomain}/entry/${slug}`;

  /**
   * Copies the provided text to the system clipboard and triggers a toast notification.
   *
   * @param {string} text - The shortlink string to copy.
   * @returns {void}
   */
  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t("dubCopiedToast"));
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Generates a tracked Dub.co shortlink for this article with UTM campaign attribution.
   *
   * @returns {void}
   */
  const handleGenerateLink = (): void => {
    startTransition(async () => {
      const res = await generateDubLinkAction({
        postId,
        originalUrl: fullArticleUrl,
        customSlug: slug,
        utmSource: "blog",
        utmMedium: "shortlink",
        utmCampaign: slug,
      });

      if (res.success && res.shortUrl) {
        setCurrentShortUrl(res.shortUrl);
        if (res.qrCodeUrl) setCurrentQr(res.qrCodeUrl);
        toast.success(t("dubGeneratedToast"));
      } else {
        toast.error(res.error || t("dubGenerateError"));
      }
    });
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text flex items-center gap-2">
              <span>{t("dubCardTitle")}</span>
              <span className="text-[10px] font-mono font-normal bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full">
                Dub Integration
              </span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {t("dubCardSubtitle")}
            </p>
          </div>
        </div>

        <a
          href="https://app.dub.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 self-start sm:self-center"
        >
          <span>{t("dubOpenDashboard")}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {currentShortUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-1">
          <div className="lg:col-span-8 space-y-3">
            <div className="p-3.5 rounded-lg bg-surface-hover/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-medium text-text-muted">{t("dubRegisteredLink")}</p>
                <a
                  href={currentShortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-bold text-sm text-accent hover:underline flex items-center gap-1.5 truncate"
                >
                  <span>{currentShortUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(currentShortUrl)}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? t("dubCopied") : t("dubCopy")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-hover/30 border border-border/60">
                <span className="text-text-muted block text-[11px]">{t("dubTotalClicksCard")}</span>
                <span className="text-lg font-bold text-text tabular-nums mt-0.5 block">
                  {dubInfo?.clicks ? dubInfo.clicks.toLocaleString() : "0"}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-hover/30 border border-border/60">
                <span className="text-text-muted block text-[11px]">{t("dubLastClicked")}</span>
                <span className="font-mono text-xs text-text block mt-1 truncate">
                  {dubInfo?.lastClicked ? new Date(dubInfo.lastClicked).toLocaleDateString() : t("dubNoRecentClicks")}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-surface-hover/20 border border-border/60 text-center space-y-2">
            {currentQr ? (
              <div className="space-y-2">
                <img
                  src={currentQr}
                  alt="QR Code"
                  className="w-24 h-24 rounded-md border border-border bg-white p-1 mx-auto shadow-xs"
                />
                <a
                  href={currentQr}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{t("dubViewQr")}</span>
                </a>
              </div>
            ) : (
              <div className="py-4 text-xs text-text-muted">
                <QrCode className="w-8 h-8 text-text-muted/40 mx-auto mb-1" />
                <p>{t("dubQrAvailable")}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-surface-hover/30 border border-dashed border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-text">{t("dubNoPostLinkYet")}</p>
            <p className="text-[11px] text-text-muted">
              {t("dubNoPostLinkDesc")}
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleGenerateLink}
            disabled={isGenerating}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            {isGenerating ? t("dubGenerating") : t("dubGenerateBtn")}
          </Button>
        </div>
      )}
    </div>
  );
}
