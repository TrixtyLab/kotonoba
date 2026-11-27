"use client";

import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSiteSettings } from "@/actions/settings";
import { testDiscordWebhookAction } from "@/actions/discord";
import { testBlueskyConnectionAction } from "@/actions/bluesky";
import { useToast } from "@/components/ui/Toast";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { DiscordSettingsCard } from "@/components/admin/settings/DiscordSettingsCard";
import { BlueskySettingsCard } from "@/components/admin/settings/BlueskySettingsCard";
import { RssSettingsCard } from "@/components/admin/settings/RssSettingsCard";
import { Share2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

/** Configuration properties for the IntegrationsSettingsClient component. */
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
 * Administrative settings coordinator for Discord Webhooks, Bluesky AT Protocol, and RSS 2.0 syndication.
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

  const [discordEnabled, setDiscordEnabled] = useState(
    initialSettings.discord_notifications_enabled === "true"
  );
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const hasSavedDiscordWebhook =
    initialSettings.has_discord_webhook_url === "true" ||
    Boolean(initialSettings.discord_webhook_url_masked);
  const [discordBotUsername, setDiscordBotUsername] = useState(
    initialSettings.discord_bot_username || ""
  );
  const [discordBotAvatar, setDiscordBotAvatar] = useState(
    initialSettings.discord_bot_avatar || ""
  );

  const [blueskyEnabled, setBlueskyEnabled] = useState(
    initialSettings.bluesky_enabled === "true"
  );
  const [blueskyIdentifier, setBlueskyIdentifier] = useState(
    initialSettings.bluesky_identifier || ""
  );
  const [blueskyAppPassword, setBlueskyAppPassword] = useState("");
  const hasSavedBlueskyPassword =
    initialSettings.has_bluesky_app_password === "true" ||
    Boolean(initialSettings.bluesky_app_password_masked);
  const [blueskyServiceUrl, setBlueskyServiceUrl] = useState(
    initialSettings.bluesky_service_url || ""
  );
  const [blueskyIncludeTags, setBlueskyIncludeTags] = useState(
    initialSettings.bluesky_include_tags !== "false"
  );
  const [blueskyIncludeTitle, setBlueskyIncludeTitle] = useState(
    initialSettings.bluesky_include_title !== "false"
  );
  const [blueskyIncludeDescription, setBlueskyIncludeDescription] = useState(
    initialSettings.bluesky_include_description !== "false"
  );

  const [rssEnabled, setRssEnabled] = useState(initialSettings.rss_enabled !== "false");
  const [rssItemsCount, setRssItemsCount] = useState(initialSettings.rss_items_count || "20");
  const [rssFullContent, setRssFullContent] = useState(
    initialSettings.rss_full_content !== "false"
  );

  const baseUrl = siteDomain.includes("localhost")
    ? `http://${siteDomain}`
    : `https://${siteDomain}`;
  const feedUrl = `${baseUrl}/feed.xml`;

  async function handleSave() {
    startTransition(async () => {
      const payload: Record<string, string> = {
        discord_notifications_enabled: discordEnabled ? "true" : "false",
        discord_bot_username: discordBotUsername.trim(),
        discord_bot_avatar: discordBotAvatar.trim(),
        bluesky_enabled: blueskyEnabled ? "true" : "false",
        bluesky_identifier: blueskyIdentifier.trim(),
        bluesky_service_url: blueskyServiceUrl.trim(),
        bluesky_include_tags: blueskyIncludeTags ? "true" : "false",
        bluesky_include_title: blueskyIncludeTitle ? "true" : "false",
        bluesky_include_description: blueskyIncludeDescription ? "true" : "false",
        rss_enabled: rssEnabled ? "true" : "false",
        rss_items_count: rssItemsCount,
        rss_full_content: rssFullContent ? "true" : "false",
      };

      if (discordWebhookUrl.trim()) payload.discord_webhook_url = discordWebhookUrl.trim();
      if (blueskyAppPassword.trim()) payload.bluesky_app_password = blueskyAppPassword.trim();

      const res = await saveSiteSettings(siteId, payload);
      if (res.success) {
        setDiscordWebhookUrl("");
        setBlueskyAppPassword("");
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        toast.error(res.error || t("saveError"));
      }
    });
  }

  async function handleTestDiscord() {
    if (!discordWebhookUrl.trim() && !hasSavedDiscordWebhook) {
      toast.error(t("discordWebhookUrlPlaceholder"));
      return;
    }

    setIsTestingDiscord(true);
    try {
      const res = await testDiscordWebhookAction(siteId, discordWebhookUrl.trim() || undefined);
      if (res.success) toast.success(t("discordTestSuccess"));
      else toast.error(res.error || t("discordTestError"));
    } catch {
      toast.error(t("discordTestError"));
    } finally {
      setIsTestingDiscord(false);
    }
  }

  async function handleTestBluesky() {
    if (!blueskyIdentifier.trim() || (!blueskyAppPassword.trim() && !hasSavedBlueskyPassword)) {
      toast.error(t("blueskyCredentialsRequired"));
      return;
    }

    setIsTestingBluesky(true);
    setTestedBlueskyProfile(null);
    try {
      const res = await testBlueskyConnectionAction({
        siteId,
        identifier: blueskyIdentifier.trim(),
        appPassword: blueskyAppPassword.trim() || undefined,
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
    <SettingsForm
      title={t("integrations")}
      description={t("integrationsDesc")}
      icon={<Share2 className="w-5 h-5 text-accent" />}
      onSave={handleSave}
      saveLabel={tc("save")}
      isPending={isPending}
    >
      <div className="space-y-8">
        <DiscordSettingsCard
          siteName={siteName}
          enabled={discordEnabled}
          onEnabledChange={setDiscordEnabled}
          webhookUrl={discordWebhookUrl}
          onWebhookUrlChange={setDiscordWebhookUrl}
          hasSavedWebhook={hasSavedDiscordWebhook}
          maskedWebhook={initialSettings.discord_webhook_url_masked}
          botUsername={discordBotUsername}
          onBotUsernameChange={setDiscordBotUsername}
          botAvatar={discordBotAvatar}
          onBotAvatarChange={setDiscordBotAvatar}
          isTesting={isTestingDiscord}
          onTest={handleTestDiscord}
        />

        <BlueskySettingsCard
          enabled={blueskyEnabled}
          onEnabledChange={setBlueskyEnabled}
          identifier={blueskyIdentifier}
          onIdentifierChange={setBlueskyIdentifier}
          appPassword={blueskyAppPassword}
          onAppPasswordChange={setBlueskyAppPassword}
          hasSavedPassword={hasSavedBlueskyPassword}
          maskedPassword={initialSettings.bluesky_app_password_masked}
          serviceUrl={blueskyServiceUrl}
          onServiceUrlChange={setBlueskyServiceUrl}
          includeTitle={blueskyIncludeTitle}
          onIncludeTitleChange={setBlueskyIncludeTitle}
          includeDescription={blueskyIncludeDescription}
          onIncludeDescriptionChange={setBlueskyIncludeDescription}
          includeTags={blueskyIncludeTags}
          onIncludeTagsChange={setBlueskyIncludeTags}
          testedProfile={testedBlueskyProfile}
          isTesting={isTestingBluesky}
          onTest={handleTestBluesky}
        />

        <RssSettingsCard
          feedUrl={feedUrl}
          enabled={rssEnabled}
          onEnabledChange={setRssEnabled}
          itemsCount={rssItemsCount}
          onItemsCountChange={setRssItemsCount}
          fullContent={rssFullContent}
          onFullContentChange={setRssFullContent}
          onCopyFeedUrl={copyFeedUrl}
        />
      </div>
    </SettingsForm>
  );
}
