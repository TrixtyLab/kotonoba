import type { Database as SqliteDatabase } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureBaseTablesAndColumns } from "./migrations/base-schema";
import { ensureAnalyticsTablesAndBackfill } from "./migrations/analytics-backfill";
import { ensureAuthorDeleteRestrict } from "./migrations/author-restrict";
import { ensureIndexesAndDeduplication, normalizeLegacyMediaAndContent } from "./migrations/cleanup";

/** Type alias for an active BetterSQLite3 Drizzle database instance. */
export type DatabaseInstance = BetterSQLite3Database<typeof schema> & {
  $client: SqliteDatabase;
};

/**
 * Idempotently executes table definitions and schema migrations on SQLite startup.
 */
export function runMigrations(dbInstance: DatabaseInstance): void {
  ensureBaseTablesAndColumns(dbInstance);
  ensureAnalyticsTablesAndBackfill(dbInstance);
  ensureAuthorDeleteRestrict(dbInstance);
  ensureIndexesAndDeduplication(dbInstance);
  normalizeLegacyMediaAndContent(dbInstance);
}
