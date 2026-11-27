/**
 * Integration secret keys stored encrypted-at-rest in SQLite `settings` and redacted
 * before entering React Server Components or client props.
 */
export const SECRET_SETTING_KEYS = new Set<string>([
  "ai_api_key",
  "discord_webhook_url",
  "bluesky_app_password",
  "s3_secret_key",
]);

/**
 * Complete allowlist of persisted site settings keys accepted via settings mutations.
 */
export const ALLOWED_SETTINGS_KEYS = new Set<string>([
  // SEO & AI crawlers
  "llms_txt_enabled",
  "llms_txt_custom",
  "block_ai_crawlers",
  // AI assistant
  "ai_api_url",
  "ai_api_key",
  "ai_model",
  "ai_temperature",
  "ai_enabled",
  // Discord integration
  "discord_notifications_enabled",
  "discord_webhook_url",
  "discord_bot_username",
  "discord_bot_avatar",
  // Bluesky integration
  "bluesky_enabled",
  "bluesky_identifier",
  "bluesky_app_password",
  "bluesky_service_url",
  "bluesky_include_tags",
  "bluesky_include_title",
  "bluesky_include_description",
  // RSS feeds
  "rss_enabled",
  "rss_items_count",
  "rss_full_content",
  // Object storage
  "storage_provider",
  "s3_bucket",
  "s3_region",
  "s3_endpoint",
  "s3_access_key",
  "s3_secret_key",
  "s3_public_url",
  // Promotional banners
  "header_banner_image",
  "header_banner_link",
  "header_banner_target",
  "header_banner_alt",
  "header_banner_schedule_enabled",
  "header_banner_scheduled_image",
  "header_banner_scheduled_link",
  "header_banner_scheduled_target",
  "header_banner_scheduled_alt",
  "header_banner_start_date",
  "header_banner_end_date",
  "sidebar_banners",
]);
