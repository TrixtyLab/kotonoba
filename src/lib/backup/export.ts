import JSZip from "jszip";
import { getDb } from "@/lib/db";
import {
  sites,
  settings,
  categories,
  tags,
  posts,
  postCategories,
  postTags,
  users,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

export interface BackupManifest {
  version: string;
  format: string;
  exportedAt: string;
  site: {
    id: string;
    name: string;
    domain: string;
  };
  counts: {
    posts: number;
    categories: number;
    tags: number;
    settings: number;
    media: number;
  };
}

export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  if (process.env.NODE_ENV === "production") return "/app/data/uploads";
  return path.join(process.cwd(), "data", "uploads");
}

/**
 * Creates a complete ZIP backup buffer containing database records and uploaded media files for a site.
 */
export async function createSiteBackupZip(siteId: string): Promise<{ buffer: Buffer; filename: string; manifest: BackupManifest }> {
  const db = getDb();

  // 1. Fetch site data
  const siteRecord = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!siteRecord) {
    throw new Error(`Site with ID "${siteId}" not found`);
  }

  // 2. Fetch all relational data
  const settingsList = db.select().from(settings).where(eq(settings.siteId, siteId)).all();
  const categoriesList = db.select().from(categories).where(eq(categories.siteId, siteId)).all();
  const tagsList = db.select().from(tags).where(eq(tags.siteId, siteId)).all();
  const postsList = db.select().from(posts).where(eq(posts.siteId, siteId)).all();

  const postIds = postsList.map((p) => p.id);
  const postCategoriesList = postIds.length > 0
    ? db.select().from(postCategories).where(inArray(postCategories.postId, postIds)).all()
    : [];
  const postTagsList = postIds.length > 0
    ? db.select().from(postTags).where(inArray(postTags.postId, postIds)).all()
    : [];

  const authorIds = Array.from(new Set(postsList.map((p) => p.authorId)));
  const authorsList = authorIds.length > 0
    ? db.select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, authorIds)).all()
    : [];

  // 3. Collect media files to bundle
  const zip = new JSZip();
  const uploadsFolder = zip.folder("uploads");
  const uploadDir = getUploadDir();
  let mediaCount = 0;

  if (uploadsFolder && existsSync(uploadDir)) {
    try {
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const fileData = await fs.readFile(filePath);
          uploadsFolder.file(file, fileData);
          mediaCount++;
        }
      }
    } catch {
      // If uploads directory read fails or is empty, proceed with 0 files
    }
  }

  // 4. Create manifest & database dump
  const manifest: BackupManifest = {
    version: "1.0.0",
    format: "kotonoba-backup",
    exportedAt: new Date().toISOString(),
    site: {
      id: siteRecord.id,
      name: siteRecord.name,
      domain: siteRecord.domain,
    },
    counts: {
      posts: postsList.length,
      categories: categoriesList.length,
      tags: tagsList.length,
      settings: settingsList.length,
      media: mediaCount,
    },
  };

  const databaseDump = {
    site: siteRecord,
    settings: settingsList,
    categories: categoriesList,
    tags: tagsList,
    posts: postsList,
    postCategories: postCategoriesList,
    postTags: postTagsList,
    authors: authorsList,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(databaseDump, null, 2));

  // 5. Generate ZIP buffer
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeSiteName = siteRecord.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `backup-${safeSiteName || "site"}-${dateSlug}.zip`;

  return { buffer, filename, manifest };
}
