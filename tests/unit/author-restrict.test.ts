import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { DatabaseInstance } from "@/lib/db/migrate";
import { ensureAuthorDeleteRestrict } from "@/lib/db/migrations/author-restrict";

describe("author foreign key rebuild", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rebuilds ON DELETE CASCADE author keys to RESTRICT and keeps rows", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-author-fk-"));
    dirs.push(dir);
    const sqlite = new Database(path.join(dir, "legacy.db"));
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE sites (id TEXT PRIMARY KEY);
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE posts (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        content TEXT DEFAULT '',
        content_md TEXT DEFAULT '',
        content_html TEXT DEFAULT '',
        content_format TEXT NOT NULL DEFAULT 'html',
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
      );
      CREATE TABLE pages (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        content TEXT DEFAULT '',
        content_md TEXT DEFAULT '',
        content_html TEXT DEFAULT '',
        content_format TEXT NOT NULL DEFAULT 'html',
        excerpt TEXT DEFAULT '',
        cover_image TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        locale TEXT NOT NULL DEFAULT 'en',
        published_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        views INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE post_categories (
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL
      );
      INSERT INTO sites (id) VALUES ('site-1');
      INSERT INTO users (id) VALUES ('author-1');
      INSERT INTO posts (id, site_id, author_id, title, slug, created_at, updated_at)
        VALUES ('post-1', 'site-1', 'author-1', 'Hello', 'hello', 1, 1);
      INSERT INTO pages (id, site_id, author_id, title, slug, created_at, updated_at)
        VALUES ('page-1', 'site-1', 'author-1', 'About', 'about', 1, 1);
      INSERT INTO post_categories (post_id, category_id) VALUES ('post-1', 'cat-1');
    `);

    const db = drizzle(sqlite, { schema });
    ensureAuthorDeleteRestrict(db as unknown as DatabaseInstance);

    const postsSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'posts'").get() as { sql: string };
    const pagesSql = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'pages'").get() as { sql: string };
    expect(postsSql.sql).toMatch(/author_id[^,]*ON DELETE RESTRICT/i);
    expect(pagesSql.sql).toMatch(/author_id[^,]*ON DELETE RESTRICT/i);
    expect(sqlite.prepare("SELECT id FROM posts WHERE id = 'post-1'").get()).toEqual({ id: "post-1" });
    expect(sqlite.prepare("SELECT id FROM pages WHERE id = 'page-1'").get()).toEqual({ id: "page-1" });
    expect(sqlite.prepare("SELECT post_id FROM post_categories").get()).toEqual({ post_id: "post-1" });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);

    ensureAuthorDeleteRestrict(db as unknown as DatabaseInstance);
    expect(postsSql.sql).toMatch(/ON DELETE RESTRICT/i);
    sqlite.close();
  });
});
