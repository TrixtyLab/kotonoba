import { getDb } from "@/lib/db";
import { pages, posts, settings, sites, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sanitizePath, unscopeStoragePath } from "@/lib/storage/paths";

function extractUploadsReferences(
  value: string | null | undefined,
  siteId: string,
  referenced: Set<string>
): void {
  if (!value) return;
  const regex = /(?:\/api)?\/uploads\/([^\s"'`<>)?#]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (!match[1]) continue;
    try {
      const decoded = sanitizePath(decodeURIComponent(match[1]));
      referenced.add(decoded);
      referenced.add(unscopeStoragePath(decoded, siteId));
    } catch {
      const raw = sanitizePath(match[1]);
      referenced.add(raw);
      referenced.add(unscopeStoragePath(raw, siteId));
    }
  }
}

/**
 * Scans site branding, user avatars, article/page bodies, and site settings in SQLite
 * to collect every media storage path currently referenced by a tenant site.
 */
export function collectReferencedMediaPaths(siteId: string): Set<string> {
  const referenced = new Set<string>();
  const db = getDb();

  const siteRow = db
    .select({ logoUrl: sites.logoUrl, faviconUrl: sites.faviconUrl })
    .from(sites)
    .where(eq(sites.id, siteId))
    .get();
  if (siteRow) {
    extractUploadsReferences(siteRow.logoUrl, siteId, referenced);
    extractUploadsReferences(siteRow.faviconUrl, siteId, referenced);
  }

  for (const row of db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.siteId, siteId)).all()) {
    extractUploadsReferences(row.avatarUrl, siteId, referenced);
  }

  for (const row of db
    .select({ coverImage: posts.coverImage, content: posts.content, contentHtml: posts.contentHtml, contentMd: posts.contentMd })
    .from(posts)
    .where(eq(posts.siteId, siteId))
    .all()) {
    extractUploadsReferences(row.coverImage, siteId, referenced);
    extractUploadsReferences(row.content, siteId, referenced);
    extractUploadsReferences(row.contentHtml, siteId, referenced);
    extractUploadsReferences(row.contentMd, siteId, referenced);
  }

  for (const row of db
    .select({ coverImage: pages.coverImage, content: pages.content, contentHtml: pages.contentHtml, contentMd: pages.contentMd })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .all()) {
    extractUploadsReferences(row.coverImage, siteId, referenced);
    extractUploadsReferences(row.content, siteId, referenced);
    extractUploadsReferences(row.contentHtml, siteId, referenced);
    extractUploadsReferences(row.contentMd, siteId, referenced);
  }

  for (const row of db.select({ value: settings.value }).from(settings).where(eq(settings.siteId, siteId)).all()) {
    extractUploadsReferences(row.value, siteId, referenced);
  }

  return referenced;
}
