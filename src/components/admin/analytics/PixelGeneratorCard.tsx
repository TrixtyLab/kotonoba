"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, QrCode, Tag, Sparkles } from "lucide-react";

interface PixelGeneratorCardProps {
  siteId: string;
  domain?: string;
}

/**
 * Interactive pixel generation card allowing content creators to create, preview, and copy 1x1 tracking image tags.
 *
 * @param {PixelGeneratorCardProps} props - Current site ID and base domain.
 * @returns {React.JSX.Element} Interactive tracking pixel configuration UI.
 */
export function PixelGeneratorCard({ siteId, domain }: PixelGeneratorCardProps): React.JSX.Element {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const [campaign, setCampaign] = useState<string>("newsletter");
  const [copied, setCopied] = useState<boolean>(false);

  const cleanCampaign = campaign.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-") || "campaign";
  const origin = typeof window !== "undefined" ? window.location.origin : domain ? `https://${domain}` : "";
  const pixelUrl = `${origin}/api/analytics/pixel?sid=${encodeURIComponent(siteId)}&src=${encodeURIComponent(cleanCampaign)}`;
  const embedCode = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard write errors
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text">{t("trackingPixels")}</h3>
            <p className="text-[11px] text-text-muted mt-0.5">{t("pixelHint")}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
            {t("pixelName")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder={t("pixelPlaceholder")}
              className="w-full sm:w-80 px-3 py-1.5 text-xs rounded-lg bg-bg border border-border text-text focus:outline-hidden focus:border-accent font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-text-muted uppercase mb-1">
            {t("pixelEmbedCode")}
          </label>
          <div className="relative flex items-center">
            <pre className="w-full px-3 py-2 text-[11px] font-mono rounded-lg bg-bg border border-border text-text overflow-x-auto select-all">
              {embedCode}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 px-2.5 py-1 text-xs font-semibold rounded-md bg-accent text-white hover:bg-accent-hover transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? tc("copied") : t("copyEmbedCode")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
