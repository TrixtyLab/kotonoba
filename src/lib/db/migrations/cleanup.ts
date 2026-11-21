import { sql } from "drizzle-orm";
import * as schema from "../schema";
import type { DatabaseInstance } from "../migrate";

function cleanPresignedMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/api/uploads/")) return trimmed.split("?")[0];
  const apiMatch = trimmed.match(/^https?:\/\/[^/]+(\/api\/uploads\/[^?#]+)/i);
  if (apiMatch?.[1]) return apiMatch[1];
  const uploadMatch = trimmed.match(/^https?:\/\/[^/]+(\/uploads\/[^?#]+)/i);
  if (uploadMatch?.[1]) return `/api${uploadMatch[1]}`;
  const staticMatch = trimmed.match(/^https?:\/\/[^/]+(\/(?:icon|logo)\.svg)/i);
  if (staticMatch?.[1]) return staticMatch[1];
  const match = trimmed.match(/^https?:\/\/[^/]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^?#]+)/i);
  if (match?.[1]) return `/api/uploads/${decodeURIComponent(match[1]).replace(/^\/+/, "")}`;
  return trimmed;
}

function cleanPresignedHtmlBody(content?: string | null): string {
  if (!content) return "";
  return content
    .replace(/https?:\/\/[^/"]+\.(?:r2\.cloudflarestorage\.com|amazonaws\.com)\/([^?"'#\s)]+)(?:\?[^"'#\s)]*)?/gi, (_m, k) => `/api/uploads/${k}`)
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/api\/uploads\/([^?"'#\s)]+)/gi, (_m, k) => `/api/uploads/${k}`);
}

/** Deduplicates pre-index rows and enforces tenant-scoped unique and lookup indexes. */
export function ensureIndexesAndDeduplication(db: DatabaseInstance): void {
  try {
    const duplicatePosts = db.all<{ id: string; slug: string }>(sql`SELECT p.id, p.slug FROM posts p WHERE EXISTS (SELECT 1 FROM posts p2 WHERE p2.site_id = p.site_id AND p2.slug = p.slug AND (p2.created_at < p.created_at OR (p2.created_at = p.created_at AND p2.rowid < p.rowid)))`);
    for (const dup of duplicatePosts) db.run(sql`UPDATE posts SET slug = ${`${dup.slug}-${dup.id.slice(0, 6)}`} WHERE id = ${dup.id}`);

    const duplicatePages = db.all<{ id: string; slug: string }>(sql`SELECT p.id, p.slug FROM pages p WHERE EXISTS (SELECT 1 FROM pages p2 WHERE p2.site_id = p.site_id AND p2.slug = p.slug AND (p2.created_at < p.created_at OR (p2.created_at = p.created_at AND p2.rowid < p.rowid)))`);
    for (const dup of duplicatePages) db.run(sql`UPDATE pages SET slug = ${`${dup.slug}-${dup.id.slice(0, 6)}`} WHERE id = ${dup.id}`);

    const duplicateCats = db.all<{ id: string; slug: string }>(sql`SELECT c.id, c.slug FROM categories c WHERE EXISTS (SELECT 1 FROM categories c2 WHERE c2.site_id = c.site_id AND c2.slug = c.slug AND c2.rowid < c.rowid)`);
    for (const dup of duplicateCats) db.run(sql`UPDATE categories SET slug = ${`${dup.slug}-${dup.id.slice(0, 6)}`} WHERE id = ${dup.id}`);

    const duplicateTags = db.all<{ id: string; slug: string }>(sql`SELECT t.id, t.slug FROM tags t WHERE EXISTS (SELECT 1 FROM tags t2 WHERE t2.site_id = t.site_id AND t2.slug = t.slug AND t2.rowid < t.rowid)`);
    for (const dup of duplicateTags) db.run(sql`UPDATE tags SET slug = ${`${dup.slug}-${dup.id.slice(0, 6)}`} WHERE id = ${dup.id}`);

    db.run(sql`DELETE FROM post_categories WHERE rowid NOT IN (SELECT MIN(rowid) FROM post_categories GROUP BY post_id, category_id)`);
    db.run(sql`DELETE FROM post_tags WHERE rowid NOT IN (SELECT MIN(rowid) FROM post_tags GROUP BY post_id, tag_id)`);
    db.run(sql`DELETE FROM settings WHERE id NOT IN (SELECT MAX(id) FROM settings GROUP BY site_id, key)`);
  } catch {}

  for (const idxName of ["posts_site_slug_idx", "pages_site_slug_idx", "categories_site_slug_idx", "tags_site_slug_idx", "settings_site_key_idx"]) {
    try {
      const existing = db.get<{ sql: string | null }>(sql`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ${idxName}`);
      if (existing?.sql && !existing.sql.toUpperCase().includes("UNIQUE")) {
        db.run(sql.raw(`DROP INDEX IF EXISTS ${idxName}`));
      }
    } catch {}
  }

  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS sites_domain_idx ON sites(domain)`,
    sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS posts_site_slug_idx ON posts(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS posts_site_status_idx ON posts(site_id, status)`,
    sql`CREATE INDEX IF NOT EXISTS posts_published_at_idx ON posts(published_at)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS pages_site_slug_idx ON pages(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS pages_site_status_idx ON pages(site_id, status)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS categories_site_slug_idx ON categories(site_id, slug)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS tags_site_slug_idx ON tags(site_id, slug)`,
    sql`CREATE INDEX IF NOT EXISTS pc_post_idx ON post_categories(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pc_category_idx ON post_categories(category_id)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS pc_post_category_idx ON post_categories(post_id, category_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_post_idx ON post_tags(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS pt_tag_idx ON post_tags(tag_id)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS pt_post_tag_idx ON post_tags(post_id, tag_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_site_idx ON analytics(site_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_post_idx ON analytics(post_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_page_idx ON analytics(page_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_created_idx ON analytics(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_site_created_idx ON analytics(site_id, created_at)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_session_idx ON analytics(session_id)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_language_idx ON analytics(language)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS analytics_daily_dim_idx ON analytics_daily(site_id, date, path, country, device)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_daily_site_date_idx ON analytics_daily(site_id, date)`,
    sql`CREATE INDEX IF NOT EXISTS analytics_segments_site_idx ON analytics_segments(site_id)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS settings_site_key_idx ON settings(site_id, key)`,
    sql`CREATE INDEX IF NOT EXISTS audit_logs_site_idx ON audit_logs(site_id)`,
    sql`CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id)`,
    sql`CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action)`,
    sql`CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS notif_outbox_post_channel_idx ON notification_outbox(post_id, channel)`,
    sql`CREATE INDEX IF NOT EXISTS notif_outbox_status_idx ON notification_outbox(status, next_attempt_at)`,
  ];
  for (const idxQuery of indexes) {
    try { db.run(idxQuery); } catch {}
  }
}

function isMarkupString(value: string): boolean {
  return /^<[a-z!/]/i.test(value.trim());
}

function resolveMigratedBodyFormat(
  sourceMd: string,
  currentFormat: "html" | "markdown"
): "html" | "markdown" {
  return isMarkupString(sourceMd) || currentFormat === "html" ? "html" : "markdown";
}

function resolveNormalizedBodies(record: {
  content: string | null;
  contentMd: string | null;
  contentHtml: string | null;
  contentFormat: "html" | "markdown";
}) {
  const cleanedCanonical = cleanPresignedHtmlBody(record.content);
  const canonicalIsHtml = isMarkupString(cleanedCanonical);
  const rawHtml = cleanPresignedHtmlBody(record.contentHtml);
  const rawMd = cleanPresignedHtmlBody(record.contentMd);
  const sourceHtml = rawHtml.length > 0 ? rawHtml : canonicalIsHtml ? cleanedCanonical : "";
  const sourceMd = rawMd.length > 0 ? rawMd : canonicalIsHtml ? "" : cleanedCanonical;
  const newFormat = resolveMigratedBodyFormat(sourceMd, record.contentFormat);
  const newHtml = newFormat === "html" && !sourceHtml ? sourceMd : sourceHtml;
  const newMd = newFormat === "html" ? "" : sourceMd;
  const newContent = newFormat === "html" ? newHtml : newMd;
  return { newContent, newMd, newHtml, newFormat };
}

function hasRecordBodyChanged(
  record: {
    coverImage: string | null;
    content: string | null;
    contentMd: string | null;
    contentHtml: string | null;
    contentFormat: "html" | "markdown";
  },
  normalized: {
    newCover: string;
    newContent: string;
    newMd: string;
    newHtml: string;
    newFormat: "html" | "markdown";
  }
): boolean {
  const targetCover = normalized.newCover ? normalized.newCover : null;
  if (targetCover !== record.coverImage) return true;
  if (normalized.newContent !== (record.content ?? "")) return true;
  if (normalized.newMd !== (record.contentMd ?? "")) return true;
  if (normalized.newHtml !== (record.contentHtml ?? "")) return true;
  return normalized.newFormat !== record.contentFormat;
}

function normalizeBodyRecord(record: {
  coverImage: string | null;
  content: string | null;
  contentMd: string | null;
  contentHtml: string | null;
  contentFormat: "html" | "markdown";
}) {
  const newCover = cleanPresignedMediaUrl(record.coverImage);
  const bodies = resolveNormalizedBodies(record);
  const changed = hasRecordBodyChanged(record, { newCover, ...bodies });
  return { changed, newCover: newCover ? newCover : null, ...bodies };
}

function cleanupSiteBrandingUrls(db: DatabaseInstance): void {
  const allSites = db.select({ id: schema.sites.id, logoUrl: schema.sites.logoUrl, faviconUrl: schema.sites.faviconUrl }).from(schema.sites).all();
  for (const site of allSites) {
    const newLogo = cleanPresignedMediaUrl(site.logoUrl);
    const newFavicon = cleanPresignedMediaUrl(site.faviconUrl);
    if (newLogo !== site.logoUrl || newFavicon !== site.faviconUrl) {
      db.update(schema.sites).set({ logoUrl: newLogo || null, faviconUrl: newFavicon || null }).where(sql`id = ${site.id}`).run();
    }
  }
}

function cleanupPostAndPageRecords(db: DatabaseInstance): void {
  for (const post of db
    .select({
      id: schema.posts.id,
      coverImage: schema.posts.coverImage,
      content: schema.posts.content,
      contentMd: schema.posts.contentMd,
      contentHtml: schema.posts.contentHtml,
      contentFormat: schema.posts.contentFormat,
    })
    .from(schema.posts)
    .all()) {
    const n = normalizeBodyRecord(post);
    if (n.changed) {
      db.update(schema.posts)
        .set({ coverImage: n.newCover, content: n.newContent, contentMd: n.newMd, contentHtml: n.newHtml, contentFormat: n.newFormat })
        .where(sql`id = ${post.id}`)
        .run();
    }
  }
  for (const page of db
    .select({
      id: schema.pages.id,
      coverImage: schema.pages.coverImage,
      content: schema.pages.content,
      contentMd: schema.pages.contentMd,
      contentHtml: schema.pages.contentHtml,
      contentFormat: schema.pages.contentFormat,
    })
    .from(schema.pages)
    .all()) {
    const n = normalizeBodyRecord(page);
    if (n.changed) {
      db.update(schema.pages)
        .set({ coverImage: n.newCover, content: n.newContent, contentMd: n.newMd, contentHtml: n.newHtml, contentFormat: n.newFormat })
        .where(sql`id = ${page.id}`)
        .run();
    }
  }
}

function cleanupUserAndSettingUrls(db: DatabaseInstance): void {
  for (const user of db.select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl }).from(schema.users).all()) {
    const newAvatar = cleanPresignedMediaUrl(user.avatarUrl);
    if (newAvatar !== user.avatarUrl) db.update(schema.users).set({ avatarUrl: newAvatar || null }).where(sql`id = ${user.id}`).run();
  }
  for (const s of db.select({ id: schema.settings.id, value: schema.settings.value }).from(schema.settings).all()) {
    if (s.value && (s.value.includes("r2.cloudflarestorage.com") || s.value.includes("amazonaws.com"))) {
      const newVal = cleanPresignedMediaUrl(s.value);
      if (newVal !== s.value) db.update(schema.settings).set({ value: newVal }).where(sql`id = ${s.id}`).run();
    }
  }
}

/** Normalizes legacy expiring presigned S3/R2 asset URLs and canonical HTML/Markdown format fields. */
export function normalizeLegacyMediaAndContent(db: DatabaseInstance): void {
  try {
    cleanupSiteBrandingUrls(db);
    cleanupPostAndPageRecords(db);
    cleanupUserAndSettingUrls(db);
  } catch {}
}
