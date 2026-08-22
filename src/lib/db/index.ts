import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureDir } from "@/lib/utils/fs";
import { runMigrations } from "./migrate";
import path from "path";

/**
 * Resolves the absolute filesystem location of the SQLite database file based on environment configuration.
 *
 * @returns An absolute filesystem path to the blog database file.
 */
function resolveDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (process.env.NODE_ENV === "production") {
    return "/app/data/kotonoba.db";
  }
  return path.join(process.cwd(), "data", "blog.db");
}

let _db: ReturnType<typeof createDb> | null = null;

/**
 * Instantiates the better-sqlite3 database connection, activates WAL mode, and executes migrations.
 *
 * @returns Configured Drizzle ORM database instance bound to the SQLite connection.
 */
function createDb() {
  const dbPath = resolveDbPath();
  ensureDir(path.dirname(dbPath));
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const drizzleDb = drizzle(sqlite, { schema });
  runMigrations(drizzleDb);
  return drizzleDb;
}

/**
 * Retrieves the global SQLite database singleton instance, initializing it lazily on first access.
 *
 * @returns The active Drizzle ORM database instance.
 */
export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
