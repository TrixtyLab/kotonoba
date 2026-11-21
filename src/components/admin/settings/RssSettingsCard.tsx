"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { Rss, Copy, ExternalLink } from "lucide-react";

interface RssSettingsCardProps {
  feedUrl: string;
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  itemsCount: string;
  onItemsCountChange: (val: string) => void;
  fullContent: boolean;
  onFullContentChange: (val: boolean) => void;
  onCopyFeedUrl: () => void;
}

/**
 * Configuration card for RSS 2.0 / Atom syndication feed URL, batch size, and content inclusion.
 */
export function RssSettingsCard({
  feedUrl,
  enabled,
  onEnabledChange,
  itemsCount,
  onItemsCountChange,
  fullContent,
  onFullContentChange,
  onCopyFeedUrl,
}: RssSettingsCardProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  return (
    <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Rss className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text">{t("rssFeed")}</h3>
            <p className="text-[11px] text-text-muted">{t("rssFeedDesc")}</p>
          </div>
        </div>

        <Switch checked={enabled} onChange={onEnabledChange} label={t("enableRss")} />
      </div>

      <div className={`space-y-4 pt-1 transition-opacity ${enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
        <div>
          <label className="block text-xs font-semibold text-text mb-1.5">{t("rssFeedUrl")}</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-hover/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text truncate select-all">
              {feedUrl}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyFeedUrl}
              icon={<Copy className="w-3.5 h-3.5" />}
              className="shrink-0 text-xs"
            >
              {tc("copy")}
            </Button>
            <a
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              title={t("rssFeed")}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t("rssItemsCount")}
            value={itemsCount}
            onChange={onItemsCountChange}
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
            ]}
          />

          <div className="flex flex-col justify-center pt-4">
            <Checkbox
              checked={fullContent}
              onChange={onFullContentChange}
              label={t("rssFullContent")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
