import fs from "fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnvConfig } from "@/lib/config/env";

/** Point-in-time operational metrics exposed to the protected metrics endpoint. */
export interface OperationalMetrics {
  timestamp: string;
  uptimeSeconds: number;
  process: {
    nodeVersion: string;
    rssBytes: number;
    heapUsedBytes: number;
  };
  database: {
    sizeBytes: number;
    walSizeBytes: number;
    sites: number;
    users: number;
    posts: number;
    publishedPosts: number;
    scheduledPosts: number;
    pages: number;
    analyticsRows: number;
    auditRows: number;
    latestAuditAt: string | null;
  };
}

/**
 * Reads the size of a file without failing when it does not exist yet.
 *
 * @param filePath - Absolute file path.
 * @returns File size in bytes, or `0` when unavailable.
 */
async function safeFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ filePath);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Collects database, process, and audit counters for dashboards and alerting.
 *
 * The endpoint is authenticated because row counts and file sizes reveal operational
 * details that should not be public. No tenant content or personal data is returned.
 *
 * @returns Aggregated operational metrics snapshot.
 */
export async function collectOperationalMetrics(): Promise<OperationalMetrics> {
  const db = getDb();
  const dbPath = getEnvConfig().dbPath;

  const countRows = (table: "sites" | "users" | "posts" | "pages" | "analytics" | "audit_logs"): number => {
    const row = db.get<{ value: number }>(sql.raw(`SELECT COUNT(*) AS value FROM ${table}`));
    return Number(row?.value ?? 0);
  };

  const [sizeBytes, walSizeBytes, latestAudit] = await Promise.all([
    safeFileSize(dbPath),
    safeFileSize(`${dbPath}-wal`),
    Promise.resolve(
      db.get<{ value: number | string | null }>(
        sql`SELECT MAX(created_at) AS value FROM audit_logs`
      )
    ),
  ]);

  const publishedPosts =
    Number(
      db.get<{ value: number }>(
        sql`SELECT COUNT(*) AS value FROM posts WHERE status = 'published'`
      )?.value ?? 0
    ) || 0;
  const scheduledPosts =
    Number(
      db.get<{ value: number }>(
        sql`SELECT COUNT(*) AS value FROM posts WHERE status = 'scheduled'`
      )?.value ?? 0
    ) || 0;

  const latestAuditSeconds = latestAudit?.value == null ? null : Number(latestAudit.value);
  const latestAuditAt =
    latestAuditSeconds !== null && Number.isFinite(latestAuditSeconds)
      ? new Date(latestAuditSeconds * 1000).toISOString()
      : null;

  const memory = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      nodeVersion: process.version,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    },
    database: {
      sizeBytes,
      walSizeBytes,
      sites: countRows("sites"),
      users: countRows("users"),
      posts: countRows("posts"),
      publishedPosts,
      scheduledPosts,
      pages: countRows("pages"),
      analyticsRows: countRows("analytics"),
      auditRows: countRows("audit_logs"),
      latestAuditAt,
    },
  };
}
