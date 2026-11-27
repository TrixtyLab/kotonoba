import type { Database as SqliteDatabase } from "better-sqlite3";
import type { DatabaseInstance } from "../migrate";

const POST_COLUMNS = [
  "id",
  "site_id",
  "author_id",
  "title",
  "slug",
  "content",
  "content_md",
  "content_html",
  "content_format",
  "excerpt",
  "cover_image",
  "status",
  "locale",
  "published_at",
  "created_at",
  "updated_at",
  "views",
  "pinned",
  "short_url",
  "dub_link_id",
] as const;

const PAGE_COLUMNS = [
  "id",
  "site_id",
  "author_id",
  "title",
  "slug",
  "content",
  "content_md",
  "content_html",
  "content_format",
  "excerpt",
  "cover_image",
  "status",
  "locale",
  "published_at",
  "created_at",
  "updated_at",
  "views",
] as const;

const POSTS_CREATE = `CREATE TABLE posts_author_fk_new (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
)`;

const PAGES_CREATE = `CREATE TABLE pages_author_fk_new (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
)`;

function tableSql(sqlite: SqliteDatabase, name: string): string {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { sql: string | null } | undefined;
  return row?.sql || "";
}

/** True when this table still deletes content with the author (`author_id` only, not `site_id`). */
function authorDeletesWithCascade(sqlText: string): boolean {
  return /author_id[^,]*ON DELETE CASCADE/i.test(sqlText);
}

function rebuildAuthorTable(
  sqlite: SqliteDatabase,
  table: "posts" | "pages",
  createSql: string,
  columns: readonly string[]
): void {
  const temp = `${table}_author_fk_new`;
  const columnList = columns.join(", ");
  sqlite.exec(`DROP TABLE IF EXISTS ${temp}`);
  sqlite.exec(createSql);
  sqlite.exec(`INSERT INTO ${temp} (${columnList}) SELECT ${columnList} FROM ${table}`);
  sqlite.exec(`DROP TABLE ${table}`);
  sqlite.exec(`ALTER TABLE ${temp} RENAME TO ${table}`);
}

/**
 * Rebuilds `posts` and `pages` so deleting a user cannot cascade-delete their content.
 * SQLite cannot change a foreign key in place. The copy runs with foreign keys off,
 * outside any caller transaction, and is skipped once `author_id` is already `RESTRICT`.
 *
 * @param db - Open Drizzle database. Indexes are recreated by the caller afterwards.
 * @throws {Error} When `PRAGMA foreign_key_check` reports a broken reference after the copy.
 */
export function ensureAuthorDeleteRestrict(db: DatabaseInstance): void {
  const sqlite = db.$client;
  const postsNeedRebuild = authorDeletesWithCascade(tableSql(sqlite, "posts"));
  const pagesNeedRebuild = authorDeletesWithCascade(tableSql(sqlite, "pages"));
  if (!postsNeedRebuild && !pagesNeedRebuild) return;

  sqlite.pragma("foreign_keys = OFF");
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    if (postsNeedRebuild) rebuildAuthorTable(sqlite, "posts", POSTS_CREATE, POST_COLUMNS);
    if (pagesNeedRebuild) rebuildAuthorTable(sqlite, "pages", PAGES_CREATE, PAGE_COLUMNS);

    const violations = sqlite.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error("foreign_key_check failed after rebuilding author foreign keys");
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // The original error is the one that must surface.
    }
    throw error;
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}
