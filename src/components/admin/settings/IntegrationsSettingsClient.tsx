"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { testDiscordWebhookAction } from "@/actions/discord";
import { testBlueskyConnectionAction } from "@/actions/bluesky";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { FaBluesky } from "react-icons/fa6";
import {
  Share2,
  Save,
  Send,
  Rss,
  Copy,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";

/**
 * Configuration properties for the IntegrationsSettingsClient component.
 */
export interface IntegrationsSettingsClientProps {
  /** Unique database identifier of the active site. */
  siteId: string;
  /** Primary site hostname or domain. */
  siteDomain: string;
  /** Display name of the site. */
  siteName: string;
  /** Key-value dictionary of existing site parameters. */
  initialSettings: Record<string, string>;
}

/**
 * Administrative settings interface for configuring Discord Webhooks, Bluesky AT Protocol auto-posting, and RSS 2.0 / Atom syndication feeds.
 *
 * @param props - IntegrationsSettingsClientProps configuring site metadata and existing integration options.
 * @returns React JSX integrations settings view.
 */
export function IntegrationsSettingsClient({
  siteId,
  siteDomain,
  siteName,
  initialSettings,
}: IntegrationsSettingsClientProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [isTestingDiscord, setIsTestingDiscord] = useState(false);
  const [isTestingBluesky, setIsTestingBluesky] = useState(false);
  const [testedBlueskyProfile, setTestedBlueskyProfile] = useState<{
    handle: string;
    displayName?: string;
    avatar?: string;
  } | null>(null);

  // Discord State
  const [discordEnabled, setDiscordEnabled] = useState(
    initialSettings.discord_notifications_enabled === "true"
  );
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(
    initialSettings.discord_webhook_url || ""
  );
  const [discordBotUsername, setDiscordBotUsername] = useState(
    initialSettings.discord_bot_username || ""
  );
  const [discordBotAvatar, setDiscordBotAvatar] = useState(
    initialSettings.discord_bot_avatar || ""
  );

  // Bluesky State
  const [blueskyEnabled, setBlueskyEnabled] = useState(
    initialSettings.bluesky_enabled === "true"
  );
  const [blueskyIdentifier, setBlueskyIdentifier] = useState(
    initialSettings.bluesky_identifier || ""
  );
  const [blueskyAppPassword, setBlueskyAppPassword] = useState(
    initialSettings.bluesky_app_password || ""
  );
  const [blueskyServiceUrl, setBlueskyServiceUrl] = useState(
    initialSettings.bluesky_service_url || ""
  );
  const [blueskyIncludeTags, setBlueskyIncludeTags] = useState(
    initialSettings.bluesky_include_tags !== "false"
  );

  // RSS State
  const [rssEnabled, setRssEnabled] = useState(
    initialSettings.rss_enabled !== "false"
  );
  const [rssItemsCount, setRssItemsCount] = useState(
    initialSettings.rss_items_count || "20"
  );
  const [rssFullContent, setRssFullContent] = useState(
    initialSettings.rss_full_content !== "false"
  );

  const baseUrl = siteDomain.includes("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;
  const feedUrl = `${baseUrl}/feed.xml`;

  async function handleSave() {
    startTransition(async () => {
      const res = await saveSiteSettings(siteId, {
        discord_notifications_enabled: discordEnabled ? "true" : "false",
        discord_webhook_url: discordWebhookUrl.trim(),
        discord_bot_username: discordBotUsername.trim(),
        discord_bot_avatar: discordBotAvatar.trim(),
        bluesky_enabled: blueskyEnabled ? "true" : "false",
        bluesky_identifier: blueskyIdentifier.trim(),
        bluesky_app_password: blueskyAppPassword.trim(),
        bluesky_service_url: blueskyServiceUrl.trim(),
        bluesky_include_tags: blueskyIncludeTags ? "true" : "false",
        rss_enabled: rssEnabled ? "true" : "false",
        rss_items_count: rssItemsCount,
        rss_full_content: rssFullContent ? "true" : "false",
      });

      if (res.success) {
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        toast.error(t("saveError"));
      }
    });
  }

  async function handleTestDiscord() {
    if (!discordWebhookUrl.trim()) {
      toast.error(t("discordWebhookUrlPlaceholder"));
      return;
    }

    setIsTestingDiscord(true);
    try {
      const res = await testDiscordWebhookAction(siteId, discordWebhookUrl.trim());
      if (res.success) {
        toast.success(t("discordTestSuccess"));
      } else {
        toast.error(res.error || t("discordTestError"));
      }
    } catch {
      toast.error(t("discordTestError"));
    } finally {
      setIsTestingDiscord(false);
    }
  }

  async function handleTestBluesky() {
    if (!blueskyIdentifier.trim() || !blueskyAppPassword.trim()) {
      toast.error(t("blueskyCredentialsRequired"));
      return;
    }

    setIsTestingBluesky(true);
    setTestedBlueskyProfile(null);
    try {
      const res = await testBlueskyConnectionAction({
        identifier: blueskyIdentifier.trim(),
        appPassword: blueskyAppPassword.trim(),
        serviceUrl: blueskyServiceUrl.trim() || undefined,
      });

      if (res.success && res.profile) {
        setTestedBlueskyProfile(res.profile);
        toast.success(t("blueskyTestSuccess", { handle: res.profile.handle }));
      } else {
        toast.error(res.error || t("blueskyTestError"));
      }
    } catch {
      toast.error(t("blueskyTestError"));
    } finally {
      setIsTestingBluesky(false);
    }
  }

  function copyFeedUrl() {
    navigator.clipboard.writeText(feedUrl);
    toast.success(tc("copied"));
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Share2 className="w-5 h-5 text-accent" />
          <span>{t("integrations")}</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{t("integrationsDesc")}</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Discord Webhook Integration Card */}
        <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center font-bold">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold text-text">{t("discordWebhook")}</h3>
                <p className="text-[11px] text-text-muted">{t("discordWebhookDesc")}</p>
              </div>
            </div>

            <Checkbox
              checked={discordEnabled}
              onChange={(checked) => setDiscordEnabled(checked)}
              label={t("enableDiscordWebhook")}
            />
          </div>

          <div className={`space-y-4 pt-1 transition-opacity ${discordEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
            <Input
              label={t("discordWebhookUrl")}
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"
              helperText={t("discordWebhookHelper")}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("discordBotUsername")}
                value={discordBotUsername}
                onChange={(e) => setDiscordBotUsername(e.target.value)}
                placeholder={siteName}
              />
              <Input
                label={t("discordBotAvatar")}
                value={discordBotAvatar}
                onChange={(e) => setDiscordBotAvatar(e.target.value)}
                placeholder="https://mysite.com/logo.png"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-text-muted">
                {t("discordWebhookDesc")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestDiscord}
                loading={isTestingDiscord}
                icon={<Send className="w-3.5 h-3.5 text-[#5865F2]" />}
                className="text-xs"
              >
                {t("sendTestDiscord")}
              </Button>
            </div>
          </div>
        </div>

        {/* Bluesky AT Protocol Integration Card */}
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

            <Checkbox
              checked={blueskyEnabled}
              onChange={(checked) => setBlueskyEnabled(checked)}
              label={t("enableBluesky")}
            />
          </div>

          <div className={`space-y-4 pt-1 transition-opacity ${blueskyEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("blueskyIdentifier")}
                value={blueskyIdentifier}
                onChange={(e) => setBlueskyIdentifier(e.target.value)}
                placeholder="username.bsky.social"
                helperText={t("blueskyIdentifierHelp")}
              />
              <Input
                label={t("blueskyAppPassword")}
                type="password"
                value={blueskyAppPassword}
                onChange={(e) => setBlueskyAppPassword(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                helperText={t("blueskyAppPasswordHelp")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <Input
                label={t("blueskyServiceUrl")}
                value={blueskyServiceUrl}
                onChange={(e) => setBlueskyServiceUrl(e.target.value)}
                placeholder="https://bsky.social"
              />
              <div className="pt-4">
                <Checkbox
                  checked={blueskyIncludeTags}
                  onChange={(checked) => setBlueskyIncludeTags(checked)}
                  label={t("blueskyIncludeTags")}
                />
              </div>
            </div>

            {testedBlueskyProfile && (
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-3">
                {testedBlueskyProfile.avatar ? (
                  <img
                    src={testedBlueskyProfile.avatar}
                    alt={testedBlueskyProfile.handle}
                    className="w-8 h-8 rounded-full border border-border shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#0085ff]/20 text-[#0085ff] flex items-center justify-center font-bold text-xs shrink-0">
                    @
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text truncate">
                    {testedBlueskyProfile.displayName || testedBlueskyProfile.handle}
                  </p>
                  <p className="text-[11px] text-text-muted font-mono truncate">
                    @{testedBlueskyProfile.handle}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t("active")}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-text-muted">
                {t("blueskyDesc")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestBluesky}
                loading={isTestingBluesky}
                icon={<FaBluesky className="w-3.5 h-3.5 text-[#0085ff]" />}
                className="text-xs"
              >
                {t("sendTestBluesky")}
              </Button>
            </div>
          </div>
        </div>

        {/* RSS 2.0 / Atom Syndication Feed Card */}
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

            <Checkbox
              checked={rssEnabled}
              onChange={(checked) => setRssEnabled(checked)}
              label={t("enableRss")}
            />
          </div>

          <div className={`space-y-4 pt-1 transition-opacity ${rssEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">
                {t("rssFeedUrl")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-hover/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text truncate select-all">
                  {feedUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyFeedUrl}
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
                  title="Feed XML"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label={t("rssItemsCount")}
                value={rssItemsCount}
                onChange={(val) => setRssItemsCount(val)}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                  { value: "100", label: "100" },
                ]}
              />

              <div className="flex flex-col justify-center pt-4">
                <Checkbox
                  checked={rssFullContent}
                  onChange={(checked) => setRssFullContent(checked)}
                  label={t("rssFullContent")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-border flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isPending}
          icon={<Save className="w-4 h-4" />}
          className="text-xs"
        >
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
