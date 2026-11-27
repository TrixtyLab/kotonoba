#!/usr/bin/env node
/**
 * Idempotent migration moving legacy un-prefixed local upload assets into `sites/<siteId>/...`
 * without breaking existing URL references unless `--prune` removes copied legacy files.
 *
 * Usage:
 *   node scripts/migrate-media-tenants.mjs [--dry-run] [--prune]
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dryRun = process.argv.includes("--dry-run");
const pruneLegacy = process.argv.includes("--prune");

const dbPath =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === "production" ? "/app/data/kotonoba.db" : path.join(process.cwd(), "data", "blog.db"));
const uploadDir =
  process.env.UPLOAD_DIR ||
  (process.env.NODE_ENV === "production" ? "/app/data/uploads" : path.join(process.cwd(), "data", "uploads"));

if (!fs.existsSync(dbPath)) {
  console.error(JSON.stringify({ ok: false, error: `Database not found at ${dbPath}` }));
  process.exit(1);
}

const db = new Database(dbPath);
const copied = [];
const skipped = [];

function extractRelativeUploadPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const match = rawUrl.match(/\/api\/uploads\/([^\s"'?#]+)/);
  if (!match?.[1]) return null;
  const clean = match[1]
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
  if (!clean || clean.startsWith("sites/")) return null;
  return clean;
}

function collectTenantReferences() {
  const refs = new Map();
  const addRef = (siteId, url) => {
    const rel = extractRelativeUploadPath(url);
    if (!rel) return;
    if (!refs.has(rel)) refs.set(rel, new Set());
    refs.get(rel).add(siteId);
  };

  for (const row of db.prepare("SELECT id, logo_url, favicon_url FROM sites").all()) {
    addRef(row.id, row.logo_url);
    addRef(row.id, row.favicon_url);
  }
  for (const row of db.prepare("SELECT site_id, cover_image, content_html, content_md FROM posts").all()) {
    addRef(row.site_id, row.cover_image);
    for (const m of `${row.content_html || ""}\n${row.content_md || ""}`.matchAll(/\/api\/uploads\/[^\s"'?#<>]+/g)) {
      addRef(row.site_id, m[0]);
    }
  }
  for (const row of db.prepare("SELECT site_id, cover_image, content_html, content_md FROM pages").all()) {
    addRef(row.site_id, row.cover_image);
    for (const m of `${row.content_html || ""}\n${row.content_md || ""}`.matchAll(/\/api\/uploads\/[^\s"'?#<>]+/g)) {
      addRef(row.site_id, m[0]);
    }
  }
  return refs;
}

const refs = collectTenantReferences();
for (const [relPath, siteIds] of refs.entries()) {
  const srcAbs = path.resolve(uploadDir, relPath);
  if (!srcAbs.startsWith(path.resolve(uploadDir)) || !fs.existsSync(srcAbs)) {
    skipped.push({ relPath, reason: "missing_source" });
    continue;
  }

  for (const siteId of siteIds) {
    const destAbs = path.resolve(uploadDir, "sites", siteId, relPath);
    if (!fs.existsSync(destAbs)) {
      if (!dryRun) {
        fs.mkdirSync(path.dirname(destAbs), { recursive: true });
        fs.copyFileSync(srcAbs, destAbs);
      }
      copied.push({ from: relPath, to: `sites/${siteId}/${relPath}` });
    } else {
      skipped.push({ relPath: `sites/${siteId}/${relPath}`, reason: "already_exists" });
    }
  }

  if (pruneLegacy && !dryRun && fs.existsSync(srcAbs)) {
    fs.unlinkSync(srcAbs);
  }
}

db.close();
console.log(JSON.stringify({ ok: true, dryRun, pruneLegacy, copiedCount: copied.length, skippedCount: skipped.length, copied }, null, 2));
