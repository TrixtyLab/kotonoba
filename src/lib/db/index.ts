import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureDir } from "@/lib/utils/fs";
import { runMigrations } from "./migrate";
import path from "path";

/**
 * Initializes and exports the SQLite database singleton using Drizzle ORM.
 * Automatically runs table migrations on startup and configures SQLite pragmas for WAL mode.
 */
function resolveDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (process.env.NODE_ENV === "production") {
    return "/app/data/blog.db";
  }
  return path.join(process.cwd(), "data", "blog.db");
}

let _db: ReturnType<typeof createDb> | null = null;

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

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type DbClient = ReturnType<typeof getDb>;
