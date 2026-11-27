import { sql, type SQL } from "drizzle-orm";
import type { DatabaseInstance } from "../migrate";

function tryRunColumns(db: DatabaseInstance, queries: SQL[]): void {
  for (const query of queries) {
    try {
      db.run(query);
    } catch {
      // Column already exists
    }
  }
}

/** Creates core CMS tables and applies additive column additions idempotently. */
export function ensureBaseTablesAndColumns(db: DatabaseInstance): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, domain TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    subtitle TEXT DEFAULT '', description TEXT DEFAULT '', logo_url TEXT, favicon_url TEXT,
    locale TEXT NOT NULL DEFAULT 'en', theme TEXT NOT NULL DEFAULT 'dark',
    custom_css TEXT DEFAULT '', primary_color TEXT DEFAULT '#6366f1', font_family TEXT DEFAULT 'Inter',
    nav_links TEXT DEFAULT '[]', nav_alignment TEXT DEFAULT 'left',
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`);

  tryRunColumns(db, [
    sql`ALTER TABLE sites ADD COLUMN subtitle TEXT DEFAULT ''`,
    sql`ALTER TABLE sites ADD COLUMN description TEXT DEFAULT ''`,
    sql`ALTER TABLE sites ADD COLUMN logo_url TEXT`,
    sql`ALTER TABLE sites ADD COLUMN favicon_url TEXT`,
    sql`ALTER TABLE sites ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`,
    sql`ALTER TABLE sites ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark'`,
    sql`ALTER TABLE sites ADD COLUMN custom_css TEXT DEFAULT ''`,
    sql`ALTER TABLE sites ADD COLUMN primary_color TEXT DEFAULT '#6366f1'`,
    sql`ALTER TABLE sites ADD COLUMN font_family TEXT DEFAULT 'Inter'`,
    sql`ALTER TABLE sites ADD COLUMN nav_links TEXT DEFAULT '[]'`,
    sql`ALTER TABLE sites ADD COLUMN nav_alignment TEXT DEFAULT 'left'`,
    sql`ALTER TABLE sites ADD COLUMN supported_locales TEXT DEFAULT '["en"]'`,
  ]);

  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'author',
    site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
    token_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  )`);

  tryRunColumns(db, [
    sql`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Admin'`,
    sql`ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    sql`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'author'`,
    sql`ALTER TABLE users ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE CASCADE`,
    sql`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1`,
  ]);

  db.run(sql`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, title TEXT NOT NULL, slug TEXT NOT NULL,
    content TEXT DEFAULT '', content_md TEXT DEFAULT '', content_html TEXT DEFAULT '', content_format TEXT NOT NULL DEFAULT 'html',
    excerpt TEXT DEFAULT '', cover_image TEXT, status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'en', published_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0,
    short_url TEXT, dub_link_id TEXT
  )`);

  tryRunColumns(db, [
    sql`ALTER TABLE posts ADD COLUMN content TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN content_md TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN content_html TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN content_format TEXT NOT NULL DEFAULT 'html'`,
    sql`ALTER TABLE posts ADD COLUMN excerpt TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN cover_image TEXT`,
    sql`ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`,
    sql`ALTER TABLE posts ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`,
    sql`ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE posts ADD COLUMN short_url TEXT`,
    sql`ALTER TABLE posts ADD COLUMN dub_link_id TEXT`,
  ]);

  db.run(sql`CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, title TEXT NOT NULL, slug TEXT NOT NULL,
    content TEXT DEFAULT '', content_md TEXT DEFAULT '', content_html TEXT DEFAULT '', content_format TEXT NOT NULL DEFAULT 'html',
    excerpt TEXT DEFAULT '', cover_image TEXT, status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'en', published_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0
  )`);

  tryRunColumns(db, [
    sql`ALTER TABLE pages ADD COLUMN content TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN content_md TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN content_html TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN content_format TEXT NOT NULL DEFAULT 'html'`,
    sql`ALTER TABLE pages ADD COLUMN excerpt TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN cover_image TEXT`,
    sql`ALTER TABLE pages ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`,
    sql`ALTER TABLE pages ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`,
    sql`ALTER TABLE pages ADD COLUMN views INTEGER NOT NULL DEFAULT 0`,
  ]);

  db.run(sql`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT DEFAULT '', parent_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`);
  db.run(sql`CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, name TEXT NOT NULL, slug TEXT NOT NULL)`);
  db.run(sql`CREATE TABLE IF NOT EXISTS post_categories (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE)`);
  db.run(sql`CREATE TABLE IF NOT EXISTS post_tags (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE)`);

  db.run(sql`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL)`);
  db.run(sql`CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, actor_email TEXT, actor_role TEXT, site_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, status TEXT NOT NULL DEFAULT 'success', ip_address TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL)`);
  db.run(sql`CREATE TABLE IF NOT EXISTS notification_outbox (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_attempt_at INTEGER, sent_at INTEGER, created_at INTEGER NOT NULL)`);
}
