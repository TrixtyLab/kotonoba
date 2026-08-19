import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Type alias for an active BetterSQLite3 Drizzle database instance.
 */
export type DatabaseInstance = BetterSQLite3Database<typeof schema>;

/**
 * Idempotently executes table definitions and schema migrations on SQLite startup.
 * Creates any missing database tables and applies incremental column additions safely.
 *
 * @param dbInstance - The Drizzle ORM database instance to migrate.
 * @returns Void.
 */
export function runMigrations(dbInstance: DatabaseInstance): void {
  const db = dbInstance;

  db.run(sql`CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    description TEXT DEFAULT '',
    logo_url TEXT,
    favicon_url TEXT,
    locale TEXT NOT NULL DEFAULT 'en',
    theme TEXT NOT NULL DEFAULT 'dark',
    custom_css TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#6366f1',
    font_family TEXT DEFAULT 'Inter',
    nav_links TEXT DEFAULT '[]',
    nav_alignment TEXT DEFAULT 'left',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  try {
    db.run(sql`ALTER TABLE sites ADD COLUMN nav_links TEXT DEFAULT '[]'`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE sites ADD COLUMN nav_alignment TEXT DEFAULT 'left'`);
  } catch {}

  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'author',
    site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content_md TEXT DEFAULT '',
    content_html TEXT DEFAULT '',
    excerpt TEXT DEFAULT '',
    cover_image TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'en',
    published_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    short_url TEXT,
    dub_link_id TEXT
  )`);

  try {
    db.run(sql`ALTER TABLE posts ADD COLUMN short_url TEXT`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE posts ADD COLUMN dub_link_id TEXT`);
  } catch {}

  db.run(sql`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT DEFAULT '',
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS post_categories (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS post_tags (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    ip_hash TEXT NOT NULL,
    country TEXT DEFAULT '',
    city TEXT DEFAULT '',
    device TEXT DEFAULT 'desktop',
    browser TEXT DEFAULT '',
    os TEXT DEFAULT '',
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    created_at INTEGER NOT NULL
  )`);

  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`);
    db.run(sql`UPDATE analytics SET created_at = timestamp WHERE created_at = 0 AND timestamp IS NOT NULL`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN utm_source TEXT`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN utm_medium TEXT`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN utm_campaign TEXT`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN utm_term TEXT`);
  } catch {}
  try {
    db.run(sql`ALTER TABLE analytics ADD COLUMN utm_content TEXT`);
  } catch {}

  db.run(sql`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL
  )`);

  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS sites_domain_idx ON sites(domain)`,
    sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`,
    sql`CREATE INDEX IF NOT EXISTS posts_site_slug_idx ON posts(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS posts_site_status_idx ON posts(site_id, status)`,
    sql`CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts(published_at)`,
    sql`CREATE INDEX IF NOT EXISTS categories_site_slug_idx ON categories(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS tags_site_slug_idx ON tags(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS pc_post_idx ON post_categories(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pc_category_idx ON post_categories(category_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_post_idx ON post_tags(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_tag_idx ON post_tags(tag_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_site_idx ON analytics(site_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_created_idx ON analytics(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS settings_site_key_idx ON settings(site_id, key)`,
  ];

  for (const idxQuery of indexes) {
    try {
      db.run(idxQuery);
    } catch {}
  }
}
