"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { FaBluesky } from "react-icons/fa6";
import { CheckCircle2 } from "lucide-react";

interface BlueskySettingsCardProps {
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  identifier: string;
  onIdentifierChange: (val: string) => void;
  appPassword: string;
  onAppPasswordChange: (val: string) => void;
  hasSavedPassword: boolean;
  maskedPassword?: string;
  serviceUrl: string;
  onServiceUrlChange: (val: string) => void;
  includeTitle: boolean;
  onIncludeTitleChange: (val: boolean) => void;
  includeDescription: boolean;
  onIncludeDescriptionChange: (val: boolean) => void;
  includeTags: boolean;
  onIncludeTagsChange: (val: boolean) => void;
  testedProfile: { handle: string; displayName?: string; avatar?: string } | null;
  isTesting: boolean;
  onTest: () => void;
}

/**
 * Configuration card for Bluesky AT Protocol cross-posting credentials and connection testing.
 */
export function BlueskySettingsCard({
  enabled,
  onEnabledChange,
  identifier,
  onIdentifierChange,
  appPassword,
  onAppPasswordChange,
  hasSavedPassword,
  maskedPassword,
  serviceUrl,
  onServiceUrlChange,
  includeTitle,
  onIncludeTitleChange,
  includeDescription,
  onIncludeDescriptionChange,
  includeTags,
  onIncludeTagsChange,
  testedProfile,
  isTesting,
  onTest,
}: BlueskySettingsCardProps) {
  const t = useTranslations("settings");

  return (
    <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0085ff]/10 text-[#0085ff] flex items-center justify-center font-bold">
            <FaBluesky className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text">{t("bluesky")}</h3>
            <p className="text-[11px] text-text-muted">{t("blueskyDesc")}</p>
          </div>
        </div>

        <Switch
          checked={enabled}
          onChange={onEnabledChange}
          label={t("enableBluesky")}
        />
      </div>

      <div className={`space-y-4 pt-1 transition-opacity ${enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t("blueskyIdentifier")}
            value={identifier}
            onChange={(e) => onIdentifierChange(e.target.value)}
            placeholder={t("blueskyIdentifierPlaceholder")}
            helperText={t("blueskyIdentifierHelp")}
          />
          <Input
            label={t("blueskyAppPassword")}
            type="password"
            autoComplete="off"
            value={appPassword}
            onChange={(e) => onAppPasswordChange(e.target.value)}
            placeholder={
              hasSavedPassword
                ? `${maskedPassword || "••••••••"} (saved)`
                : "xxxx-xxxx-xxxx-xxxx"
            }
            helperText={t("blueskyAppPasswordHelp")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <Input
            label={t("blueskyServiceUrl")}
            value={serviceUrl}
            onChange={(e) => onServiceUrlChange(e.target.value)}
            placeholder="https://bsky.social"
          />
          <div className="pt-4 space-y-3">
            <Checkbox
              checked={includeTitle}
              onChange={onIncludeTitleChange}
              label={t("blueskyIncludeTitle")}
            />
            <Checkbox
              checked={includeDescription}
              onChange={onIncludeDescriptionChange}
              label={t("blueskyIncludeDescription")}
            />
            <Checkbox
              checked={includeTags}
              onChange={onIncludeTagsChange}
              label={t("blueskyIncludeTags")}
            />
          </div>
        </div>

        {testedProfile && (
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-3">
            {testedProfile.avatar ? (
              <img
                src={testedProfile.avatar}
                alt={testedProfile.handle}
                className="w-8 h-8 rounded-full border border-border shrink-0 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0085ff]/20 text-[#0085ff] flex items-center justify-center font-bold text-xs shrink-0">
                @
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text truncate">
                {testedProfile.displayName || testedProfile.handle}
              </p>
              <p className="text-[11px] text-text-muted font-mono truncate">
                @{testedProfile.handle}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t("active")}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-text-muted">{t("blueskyDesc")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            loading={isTesting}
            icon={<FaBluesky className="w-3.5 h-3.5 text-[#0085ff]" />}
            className="text-xs"
          >
            {t("sendTestBluesky")}
          </Button>
        </div>
      </div>
    </div>
  );
}
