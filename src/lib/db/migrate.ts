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

  const sitesColumns = [
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
  ];
  for (const query of sitesColumns) {
    try {
      db.run(query);
    } catch { }
  }


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

  const usersColumns = [
    sql`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Admin'`,
    sql`ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    sql`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'author'`,
    sql`ALTER TABLE users ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE CASCADE`,
  ];
  for (const query of usersColumns) {
    try {
      db.run(query);
    } catch { }
  }

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

  const postsColumns = [
    sql`ALTER TABLE posts ADD COLUMN content_md TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN content_html TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN excerpt TEXT DEFAULT ''`,
    sql`ALTER TABLE posts ADD COLUMN cover_image TEXT`,
    sql`ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`,
    sql`ALTER TABLE posts ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`,
    sql`ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE posts ADD COLUMN short_url TEXT`,
    sql`ALTER TABLE posts ADD COLUMN dub_link_id TEXT`,
  ];
  for (const query of postsColumns) {
    try {
      db.run(query);
    } catch { }
  }

  db.run(sql`CREATE TABLE IF NOT EXISTS pages (
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
    views INTEGER NOT NULL DEFAULT 0
  )`);

  const pagesColumns = [
    sql`ALTER TABLE pages ADD COLUMN content_md TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN content_html TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN excerpt TEXT DEFAULT ''`,
    sql`ALTER TABLE pages ADD COLUMN cover_image TEXT`,
    sql`ALTER TABLE pages ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`,
    sql`ALTER TABLE pages ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'`,
    sql`ALTER TABLE pages ADD COLUMN views INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const query of pagesColumns) {
    try {
      db.run(query);
    } catch { }
  }

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
    page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    referrer TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    ip_hash TEXT NOT NULL DEFAULT '',
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
    created_at INTEGER NOT NULL DEFAULT 0
  )`);

  const analyticsColumns = [
    sql`ALTER TABLE analytics ADD COLUMN ip_hash TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE CASCADE`,
    sql`ALTER TABLE analytics ADD COLUMN page_id TEXT REFERENCES pages(id) ON DELETE CASCADE`,
    sql`ALTER TABLE analytics ADD COLUMN referrer TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN user_agent TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN country TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN city TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN device TEXT DEFAULT 'desktop'`,
    sql`ALTER TABLE analytics ADD COLUMN browser TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN os TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN utm_source TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_medium TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_campaign TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_term TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_content TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const query of analyticsColumns) {
    try {
      db.run(query);
    } catch { }
  }

  try {
    db.run(sql`UPDATE analytics SET created_at = timestamp WHERE created_at = 0 AND timestamp IS NOT NULL`);
  } catch {}

  try {
    // Backfill browser and device for legacy analytics rows with missing browser
    const legacyHits = db.select({
      id: schema.analytics.id,
      userAgent: schema.analytics.userAgent,
    }).from(schema.analytics).where(sql`browser IS NULL OR browser = ''`).all();

    for (const row of legacyHits) {
      if (row.userAgent) {
        const ua = row.userAgent.toLowerCase();
        let dev = "desktop";
        if (/ipad|tablet|playbook|silk/i.test(ua) || (ua.includes("android") && !ua.includes("mobile"))) {
          dev = "tablet";
        } else if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
          dev = "mobile";
        }

        let br = "Other";
        if (ua.includes("edg/") || ua.includes("edge/")) {
          br = "Edge";
        } else if (ua.includes("opr/") || ua.includes("opera")) {
          br = "Opera";
        } else if (ua.includes("samsungbrowser")) {
          br = "Samsung Internet";
        } else if (ua.includes("brave")) {
          br = "Brave";
        } else if (ua.includes("vivaldi")) {
          br = "Vivaldi";
        } else if (ua.includes("duckduckgo")) {
          br = "DuckDuckGo";
        } else if (ua.includes("firefox") || ua.includes("fxios")) {
          br = "Firefox";
        } else if (ua.includes("chrome") || ua.includes("crios") || ua.includes("chromium")) {
          br = "Chrome";
        } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android")) {
          br = "Safari";
        }

        db.update(schema.analytics).set({ browser: br, device: dev }).where(sql`id = ${row.id}`).run();
      }
    }
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
    sql`CREATE INDEX IF NOT EXISTS pages_site_slug_idx ON pages(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS pages_site_status_idx ON pages(site_id, status)`,
    sql`CREATE INDEX IF NOT EXISTS categories_site_slug_idx ON categories(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS tags_site_slug_idx ON tags(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS pc_post_idx ON post_categories(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pc_category_idx ON post_categories(category_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_post_idx ON post_tags(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_tag_idx ON post_tags(tag_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_site_idx ON analytics(site_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_post_idx ON analytics(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_page_idx ON analytics(page_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_created_idx ON analytics(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS settings_site_key_idx ON settings(site_id, key)`,
  ];

  for (const idxQuery of indexes) {
    try {
      db.run(idxQuery);
    } catch {}
  }

  // Backfill and clean legacy expiring Cloudflare R2 / AWS S3 presigned URLs in DB
  try {
    const cleanMedia = (url?: string | null): string => {
      if (!url || typeof url !== "string") return "";
      const trimmed = url.trim();
      if (trimmed.startsWith("/api/uploads/")) return trimmed.split("?")[0];
      const match = trimmed.match(/^https?:\/\/[^/]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^?#]+)/i);
      if (match && match[1]) {
        return `/api/uploads/${decodeURIComponent(match[1]).replace(/^\/+/, "")}`;
      }
      return trimmed;
    };

    const cleanHtml = (content?: string | null): string => {
      if (!content) return "";
      return content.replace(
        /https?:\/\/[^/"]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^?"'#\s)]+)(?:\?[^"'#\s)]*)?/gi,
        (_match, fileKey) => `/api/uploads/${fileKey}`
      );
    };

    const allSites = db.select({ id: schema.sites.id, logoUrl: schema.sites.logoUrl, faviconUrl: schema.sites.faviconUrl }).from(schema.sites).all();
    for (const site of allSites) {
      const newLogo = cleanMedia(site.logoUrl);
      const newFavicon = cleanMedia(site.faviconUrl);
      if (newLogo !== site.logoUrl || newFavicon !== site.faviconUrl) {
        db.update(schema.sites).set({ logoUrl: newLogo || null, faviconUrl: newFavicon || null }).where(sql`id = ${site.id}`).run();
      }
    }

    const allPosts = db.select({ id: schema.posts.id, coverImage: schema.posts.coverImage, contentMd: schema.posts.contentMd, contentHtml: schema.posts.contentHtml }).from(schema.posts).all();
    for (const post of allPosts) {
      const newCover = cleanMedia(post.coverImage);
      const newMd = cleanHtml(post.contentMd);
      const newHtml = cleanHtml(post.contentHtml);
      if (newCover !== post.coverImage || newMd !== post.contentMd || newHtml !== post.contentHtml) {
        db.update(schema.posts).set({ coverImage: newCover || null, contentMd: newMd, contentHtml: newHtml }).where(sql`id = ${post.id}`).run();
      }
    }

    const allPages = db.select({ id: schema.pages.id, coverImage: schema.pages.coverImage, contentMd: schema.pages.contentMd, contentHtml: schema.pages.contentHtml }).from(schema.pages).all();
    for (const page of allPages) {
      const newCover = cleanMedia(page.coverImage);
      const newMd = cleanHtml(page.contentMd);
      const newHtml = cleanHtml(page.contentHtml);
      if (newCover !== page.coverImage || newMd !== page.contentMd || newHtml !== page.contentHtml) {
        db.update(schema.pages).set({ coverImage: newCover || null, contentMd: newMd, contentHtml: newHtml }).where(sql`id = ${page.id}`).run();
      }
    }

    const allUsers = db.select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl }).from(schema.users).all();
    for (const user of allUsers) {
      const newAvatar = cleanMedia(user.avatarUrl);
      if (newAvatar !== user.avatarUrl) {
        db.update(schema.users).set({ avatarUrl: newAvatar || null }).where(sql`id = ${user.id}`).run();
      }
    }

    const allSettings = db.select({ id: schema.settings.id, key: schema.settings.key, value: schema.settings.value }).from(schema.settings).all();
    for (const s of allSettings) {
      if (s.value && (s.value.includes("r2.cloudflarestorage.com") || s.value.includes("amazonaws.com"))) {
        const newVal = cleanMedia(s.value);
        if (newVal !== s.value) {
          db.update(schema.settings).set({ value: newVal }).where(sql`id = ${s.id}`).run();
        }
      }
    }
  } catch {}
}
