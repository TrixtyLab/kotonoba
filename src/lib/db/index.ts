import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureDir } from "@/lib/utils/fs";
import { getRuntimeDbPath } from "@/lib/config/env";
import { runMigrations } from "./migrate";
import path from "path";

let _db: ReturnType<typeof createDb> | null = null;
let _sqlite: Database.Database | null = null;

/**
 * Instantiates the better-sqlite3 database connection, activates WAL mode, and executes migrations.
 *
 * @returns Configured Drizzle ORM database instance bound to the SQLite connection.
 */
function createDb() {
  const dbPath = getRuntimeDbPath();
  ensureDir(path.dirname(dbPath));
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  _sqlite = sqlite;
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

/**
 * Closes and clears the cached SQLite connection so tests can swap `DB_PATH` cleanly.
 */
export function resetDbForTesting(): void {
  if (_sqlite) {
    try {
      _sqlite.close();
    } catch {
      // Ignore close errors during test teardown
    }
    _sqlite = null;
  }
  _db = null;
}

export type Db = ReturnType<typeof getDb>;
