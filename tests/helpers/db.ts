import fs from "fs";
import os from "os";
import path from "path";
import { getDb, resetDbForTesting, type Db } from "@/lib/db";

export interface TempDbContext {
  dbPath: string;
  db: Db;
  cleanup: () => void;
}

/**
 * Provisions a fresh temporary SQLite database with full migrations applied.
 */
export function createTempDb(prefix = "kotonoba-test"): TempDbContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const dbPath = path.join(dir, "test.db");

  resetDbForTesting();
  process.env.DB_PATH = dbPath;
  const db = getDb();

  return {
    dbPath,
    db,
    cleanup: () => {
      resetDbForTesting();
      delete process.env.DB_PATH;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore transient Windows file lock cleanup warnings
      }
    },
  };
}
