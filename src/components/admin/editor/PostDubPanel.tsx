"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Copy, QrCode, Share2, Sparkles } from "lucide-react";
import { generateSlug } from "@/lib/utils/slug";
import { useToast } from "@/components/ui/Toast";

/** Props for {@link PostDubPanel}. */
export interface PostDubPanelProps {
  shortUrl: string;
  qrCodeUrl: string;
  title: string;
  slug: string;
  dubModalOpen: boolean;
  setDubModalOpen: (open: boolean) => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  utmSource: string;
  setUtmSource: (val: string) => void;
  utmMedium: string;
  setUtmMedium: (val: string) => void;
  utmCampaign: string;
  setUtmCampaign: (val: string) => void;
  isGeneratingDub: boolean;
  onGenerateDubLink: () => void;
}

/** Dub.co short-link sidebar panel plus UTM builder and QR modals. */
export function PostDubPanel({
  shortUrl,
  qrCodeUrl,
  title,
  slug,
  dubModalOpen,
  setDubModalOpen,
  qrModalOpen,
  setQrModalOpen,
  utmSource,
  setUtmSource,
  utmMedium,
  setUtmMedium,
  utmCampaign,
  setUtmCampaign,
  isGeneratingDub,
  onGenerateDubLink,
}: PostDubPanelProps) {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const toast = useToast();

  return (
    <>
      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-accent" />
            <span>{t("dubShortLink")}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDubModalOpen(true)}
            className="text-[11px] text-accent p-0 h-auto font-bold flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {shortUrl ? "UTM Builder" : t("generateDubLink")}
          </Button>
        </div>

        {shortUrl ? (
          <div className="flex items-center gap-1.5 bg-surface-hover/50 p-1.5 rounded-lg border border-border">
            <input
              type="text"
              readOnly
              value={shortUrl}
              className="bg-transparent text-xs font-mono text-text flex-1 outline-hidden select-all"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(shortUrl);
                toast.success(t("dubCopied"));
              }}
              className="p-1 h-auto text-xs shrink-0"
              title={tc("copy")}
            >
              <Copy className="w-3 h-3" />
            </Button>
            {qrCodeUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQrModalOpen(true)}
                className="p-1 h-auto text-xs shrink-0"
                title={tc("qrCode")}
              >
                <QrCode className="w-3 h-3" />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted leading-tight">{t("dubPromoDesc")}</p>
        )}
      </div>

      <Modal isOpen={dubModalOpen} onClose={() => setDubModalOpen(false)} title={t("dubModalTitle")}>
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">{t("dubModalDesc")}</p>

          <div className="space-y-3">
            <Input
              label={t("utmSourceLabel")}
              placeholder={t("utmSourcePlaceholder")}
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
            />
            <Input
              label={t("utmMediumLabel")}
              placeholder={t("utmMediumPlaceholder")}
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
            />
            <Input
              label={t("utmCampaignLabel")}
              placeholder={t("utmCampaignPlaceholder")}
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
            />
          </div>

          <div className="p-3 bg-surface-hover/30 border border-border rounded-lg space-y-1 text-text-muted">
            <p className="font-semibold text-text flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-accent" />
              {t("originalDestination")}
            </p>
            <p className="font-mono text-[11px] truncate">
              {typeof window !== "undefined" ? window.location.origin : ""}/entry/{slug || generateSlug(title)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setDubModalOpen(false)} className="text-xs">
              {tc("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={onGenerateDubLink}
              loading={isGeneratingDub}
              icon={<Sparkles className="w-4 h-4" />}
              className="text-xs"
            >
              {t("generateWithDub")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title={t("qrModalTitle")}>
        <div className="space-y-4 text-xs text-center">
          <p className="text-text-muted">{t("qrModalDesc")}</p>

          {qrCodeUrl && (
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-border inline-block">
                <img src={qrCodeUrl} alt={t("qrModalTitle")} className="w-48 h-48 object-contain" />
              </div>
            </div>
          )}

          {shortUrl && (
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-accent font-semibold">{shortUrl}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shortUrl);
                  toast.success(tc("copied"));
                }}
                className="text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> {tc("copy")}
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="primary" onClick={() => setQrModalOpen(false)} className="text-xs">
              {t("close")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
