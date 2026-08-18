import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("sites_domain_idx").on(table.domain),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["super_admin", "admin", "editor", "author"] }).notNull().default("author"),
  siteId: text("site_id").references(() => sites.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  contentMd: text("content_md").default(""),
  contentHtml: text("content_html").default(""),
  excerpt: text("excerpt").default(""),
  coverImage: text("cover_image"),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  locale: text("locale").default("en").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  views: integer("views").default(0).notNull(),
  pinned: integer("pinned", { mode: "boolean" }).default(false).notNull(),
}, (table) => [
  index("posts_site_slug_idx").on(table.siteId, table.slug),
  index("posts_site_status_idx").on(table.siteId, table.status),
  index("posts_published_at_idx").on(table.publishedAt),
]);

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").default(""),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  index("categories_site_slug_idx").on(table.siteId, table.slug),
]);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
}, (table) => [
  index("tags_site_slug_idx").on(table.siteId, table.slug),
]);

export const postCategories = sqliteTable("post_categories", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => [
  index("pc_post_idx").on(table.postId),
  index("pc_category_idx").on(table.categoryId),
]);

export const postTags = sqliteTable("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  index("pt_post_idx").on(table.postId),
  index("pt_tag_idx").on(table.tagId),
]);

export const analytics = sqliteTable("analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  country: text("country"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("analytics_site_ts_idx").on(table.siteId, table.timestamp),
  index("analytics_post_idx").on(table.postId),
]);

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull().default(""),
}, (table) => [
  uniqueIndex("settings_site_key_idx").on(table.siteId, table.key),
]);
