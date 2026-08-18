import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type DatabaseInstance = BetterSQLite3Database<typeof schema>;

/**
 * Runs Drizzle/SQLite table creation if tables do not exist.
 * Designed to execute idempotently upon initial connection.
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
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

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
    pinned INTEGER NOT NULL DEFAULT 0
  )`);

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
    post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
    path TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    country TEXT,
    timestamp INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT ''
  )`);

  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS settings_site_key_idx ON settings(site_id, key)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS posts_site_slug_idx ON posts(site_id, slug)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS posts_site_status_idx ON posts(site_id, status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts(published_at)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS categories_site_slug_idx ON categories(site_id, slug)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS tags_site_slug_idx ON tags(site_id, slug)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS analytics_site_ts_idx ON analytics(site_id, timestamp)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS analytics_post_idx ON analytics(post_id)`);
}
