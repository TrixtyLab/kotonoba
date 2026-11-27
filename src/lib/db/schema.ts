import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Multi-tenant blog sites table storing domain routing, branding, typography, and navigation configuration.
 */
export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  subtitle: text("subtitle").default(""),
  description: text("description").default(""),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  locale: text("locale").default("en").notNull(),
  theme: text("theme").default("dark").notNull(),
  customCss: text("custom_css").default(""),
  primaryColor: text("primary_color").default("#6366f1"),
  fontFamily: text("font_family").default("Inter"),
  navLinks: text("nav_links").default("[]"),
  navAlignment: text("nav_alignment", { enum: ["left", "center", "right"] }).default("left"),
  supportedLocales: text("supported_locales").default('["en"]'),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("sites_domain_idx").on(table.domain),
]);

/**
 * User accounts table with role-based access control (super_admin, admin, editor, author).
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["super_admin", "admin", "editor", "author"] }).notNull().default("author"),
  siteId: text("site_id").references(() => sites.id, { onDelete: "cascade" }),
  tokenVersion: integer("token_version").default(1).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

/**
 * Blog articles table storing Markdown & HTML content, SEO metadata, Dub.co short links, and view metrics.
 */
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content").default(""),
  contentMd: text("content_md").default(""),
  contentHtml: text("content_html").default(""),
  contentFormat: text("content_format", { enum: ["html", "markdown"] }).default("html").notNull(),
  excerpt: text("excerpt").default(""),
  coverImage: text("cover_image"),
  status: text("status", { enum: ["draft", "published", "scheduled", "archived"] }).notNull().default("draft"),
  locale: text("locale").default("en").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  views: integer("views").default(0).notNull(),
  pinned: integer("pinned", { mode: "boolean" }).default(false).notNull(),
  shortUrl: text("short_url"),
  dubLinkId: text("dub_link_id"),
}, (table) => [
  uniqueIndex("posts_site_slug_idx").on(table.siteId, table.slug),
  index("posts_site_status_idx").on(table.siteId, table.status),
  index("posts_published_at_idx").on(table.publishedAt),
]);

/**
 * Custom static pages table storing standalone content (About, Terms, Contact, etc.) with Markdown and HTML.
 */
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  content: text("content").default(""),
  contentMd: text("content_md").default(""),
  contentHtml: text("content_html").default(""),
  contentFormat: text("content_format", { enum: ["html", "markdown"] }).default("html").notNull(),
  excerpt: text("excerpt").default(""),
  coverImage: text("cover_image"),
  status: text("status", { enum: ["draft", "published", "scheduled", "archived"] }).notNull().default("draft"),
  locale: text("locale").default("en").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  views: integer("views").default(0).notNull(),
}, (table) => [
  uniqueIndex("pages_site_slug_idx").on(table.siteId, table.slug),
  index("pages_site_status_idx").on(table.siteId, table.status),
]);

/**
 * Hierarchical category taxonomy table for grouping related articles.
 */
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").default(""),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  uniqueIndex("categories_site_slug_idx").on(table.siteId, table.slug),
]);

/**
 * Keyword tags taxonomy table for cross-cutting article classification.
 */
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
}, (table) => [
  uniqueIndex("tags_site_slug_idx").on(table.siteId, table.slug),
]);

/**
 * Many-to-many junction table associating posts with categories.
 */
export const postCategories = sqliteTable("post_categories", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => [
  index("pc_post_idx").on(table.postId),
  index("pc_category_idx").on(table.categoryId),
  uniqueIndex("pc_post_category_idx").on(table.postId, table.categoryId),
]);

/**
 * Many-to-many junction table associating posts with tags.
 */
export const postTags = sqliteTable("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  index("pt_post_idx").on(table.postId),
  index("pt_tag_idx").on(table.tagId),
  uniqueIndex("pt_post_tag_idx").on(table.postId, table.tagId),
]);

/**
 * Privacy-friendly visitor analytics and pageview tracking records.
 */
export const analytics = sqliteTable("analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => pages.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  referrer: text("referrer").default(""),
  userAgent: text("user_agent").default(""),
  ipHash: text("ip_hash").notNull(),
  country: text("country").default(""),
  city: text("city").default(""),
  device: text("device").default("desktop"),
  browser: text("browser").default(""),
  os: text("os").default(""),
  language: text("language").default(""),
  sessionId: text("session_id").default(""),
  loadTime: integer("load_time"),
  timeOnPage: integer("time_on_page").default(0),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("analytics_site_idx").on(table.siteId),
  index("analytics_post_idx").on(table.postId),
  index("analytics_page_idx").on(table.pageId),
  index("analytics_created_idx").on(table.createdAt),
  index("analytics_site_created_idx").on(table.siteId, table.createdAt),
  index("analytics_session_idx").on(table.sessionId),
  index("analytics_language_idx").on(table.language),
]);

/**
 * Daily pre-aggregated analytics rollups preserving historical traffic metrics after raw hit pruning.
 */
export const analyticsDaily = sqliteTable("analytics_daily", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  path: text("path").notNull(),
  country: text("country").default("").notNull(),
  device: text("device").default("desktop").notNull(),
  views: integer("views").default(0).notNull(),
  uniqueVisitors: integer("unique_visitors").default(0).notNull(),
}, (table) => [
  uniqueIndex("analytics_daily_dim_idx").on(table.siteId, table.date, table.path, table.country, table.device),
  index("analytics_daily_site_date_idx").on(table.siteId, table.date),
]);

/**
 * Key-value settings table storing site-scoped integration keys and configurations.
 */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => [
  uniqueIndex("settings_site_key_idx").on(table.siteId, table.key),
]);

/**
 * Saved filter segments for custom analytics reporting and cohort slicing.
 */
export const analyticsSegments = sqliteTable("analytics_segments", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("analytics_segments_site_idx").on(table.siteId),
]);

/**
 * Security audit log recording privileged administrative and tenant operations.
 */
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  actorRole: text("actor_role"),
  siteId: text("site_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  status: text("status", { enum: ["success", "failure", "denied"] }).notNull().default("success"),
  ipAddress: text("ip_address"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("audit_logs_site_idx").on(table.siteId),
  index("audit_logs_actor_idx").on(table.actorId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_created_idx").on(table.createdAt),
]);

/**
 * Persistent notification delivery outbox for idempotent retries when publishing scheduled posts.
 */
export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["discord", "bluesky"] }).notNull(),
  status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("notif_outbox_post_channel_idx").on(table.postId, table.channel),
  index("notif_outbox_status_idx").on(table.status, table.nextAttemptAt),
]);

