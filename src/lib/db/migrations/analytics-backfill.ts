import { sql } from "drizzle-orm";
import * as schema from "../schema";
import type { DatabaseInstance } from "../migrate";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";

/** Ensures analytics tables/columns exist and repairs legacy timestamp and browser rows. */
export function ensureAnalyticsTablesAndBackfill(db: DatabaseInstance): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE, page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
    path TEXT NOT NULL, referrer TEXT DEFAULT '', user_agent TEXT DEFAULT '', ip_hash TEXT NOT NULL DEFAULT '',
    country TEXT DEFAULT '', city TEXT DEFAULT '', device TEXT DEFAULT 'desktop', browser TEXT DEFAULT '',
    os TEXT DEFAULT '', language TEXT DEFAULT '', session_id TEXT DEFAULT '', load_time INTEGER,
    time_on_page INTEGER DEFAULT 0, screen_width INTEGER, screen_height INTEGER,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);

  const analyticsCols = [
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
    sql`ALTER TABLE analytics ADD COLUMN language TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN session_id TEXT DEFAULT ''`,
    sql`ALTER TABLE analytics ADD COLUMN load_time INTEGER`,
    sql`ALTER TABLE analytics ADD COLUMN time_on_page INTEGER DEFAULT 0`,
    sql`ALTER TABLE analytics ADD COLUMN screen_width INTEGER`,
    sql`ALTER TABLE analytics ADD COLUMN screen_height INTEGER`,
    sql`ALTER TABLE analytics ADD COLUMN utm_source TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_medium TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_campaign TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_term TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN utm_content TEXT`,
    sql`ALTER TABLE analytics ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const query of analyticsCols) {
    try { db.run(query); } catch {}
  }

  db.run(sql`CREATE TABLE IF NOT EXISTS analytics_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    date TEXT NOT NULL, path TEXT NOT NULL, country TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT 'desktop',
    views INTEGER NOT NULL DEFAULT 0, unique_visitors INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS analytics_segments (
    id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL, filters TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
  )`);

  try {
    const tableInfo = db.all<{ name: string }>(sql`PRAGMA table_info(analytics)`);
    if (tableInfo.some((col) => col.name === "timestamp")) {
      try {
        db.run(sql`UPDATE analytics SET created_at = timestamp WHERE (created_at = 0 OR created_at IS NULL) AND timestamp IS NOT NULL`);
        db.run(sql`ALTER TABLE analytics DROP COLUMN timestamp`);
      } catch {
        db.run(sql`CREATE TABLE analytics_migration_temp (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, post_id TEXT REFERENCES posts(id) ON DELETE CASCADE, page_id TEXT REFERENCES pages(id) ON DELETE CASCADE, path TEXT NOT NULL, referrer TEXT DEFAULT '', user_agent TEXT DEFAULT '', ip_hash TEXT NOT NULL DEFAULT '', country TEXT DEFAULT '', city TEXT DEFAULT '', device TEXT DEFAULT 'desktop', browser TEXT DEFAULT '', os TEXT DEFAULT '', utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, created_at INTEGER NOT NULL DEFAULT 0);`);
        db.run(sql`INSERT INTO analytics_migration_temp (id, site_id, post_id, page_id, path, referrer, user_agent, ip_hash, country, city, device, browser, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at) SELECT id, site_id, post_id, page_id, path, referrer, user_agent, ip_hash, country, city, device, browser, os, utm_source, utm_medium, utm_campaign, utm_term, utm_content, COALESCE(NULLIF(created_at, 0), timestamp, CAST(strftime('%s','now') AS INTEGER) * 1000) FROM analytics;`);
        db.run(sql`DROP TABLE analytics;`);
        db.run(sql`ALTER TABLE analytics_migration_temp RENAME TO analytics;`);
      }
    }
  } catch (err) {
    console.warn("Analytics legacy timestamp migration notice:", err);
  }

  try {
    const legacyHits = db.select({ id: schema.analytics.id, userAgent: schema.analytics.userAgent }).from(schema.analytics).where(sql`browser IS NULL OR browser = ''`).all();
    for (const row of legacyHits) {
      if (!row.userAgent) continue;
      const parsed = parseDeviceAndBrowser(row.userAgent);
      db.update(schema.analytics).set({ browser: parsed.browser, device: parsed.device }).where(sql`id = ${row.id}`).run();
    }
    db.run(sql`UPDATE analytics SET created_at = CAST(created_at / 1000 AS INTEGER) WHERE created_at >= 1000000000000`);
  } catch {}
}
