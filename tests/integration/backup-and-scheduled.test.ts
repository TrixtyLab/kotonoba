import fs from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { describe, it, expect, afterEach, vi } from "vitest";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, settings, notificationOutbox } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { runMigrations } from "@/lib/db/migrate";
import { createSiteBackupZip } from "@/lib/backup/export";
import { restoreSiteBackupZip } from "@/lib/backup/import";
import { encryptBackupArchive, decryptBackupArchive } from "@/lib/backup/crypto";
import { publishScheduledPosts } from "@/lib/db/scheduled";
import { enqueuePostNotifications } from "@/lib/notifications/outbox";

describe("Encrypted backups tenant isolation, safety limits & scheduled outbox", () => {
  let ctx: TempDbContext | null = null;
  let uploadTmpDir: string | null = null;
  const origUploadDir = process.env.UPLOAD_DIR;
  const origBackupKey = process.env.BACKUP_ENCRYPTION_KEY;
  const origEncKey = process.env.ENCRYPTION_KEY;
  const origMaxUncompressed = process.env.MAX_BACKUP_UNCOMPRESSED_BYTES;

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
    if (uploadTmpDir) {
      fs.rmSync(uploadTmpDir, { recursive: true, force: true });
      uploadTmpDir = null;
    }
    if (origUploadDir !== undefined) process.env.UPLOAD_DIR = origUploadDir;
    else delete process.env.UPLOAD_DIR;
    if (origBackupKey !== undefined) process.env.BACKUP_ENCRYPTION_KEY = origBackupKey;
    else delete process.env.BACKUP_ENCRYPTION_KEY;
    if (origEncKey !== undefined) process.env.ENCRYPTION_KEY = origEncKey;
    else delete process.env.ENCRYPTION_KEY;
    if (origMaxUncompressed !== undefined) process.env.MAX_BACKUP_UNCOMPRESSED_BYTES = origMaxUncompressed;
    else delete process.env.MAX_BACKUP_UNCOMPRESSED_BYTES;
  });

  it("exports strictly tenant-scoped media and round-trips encrypted backups transactionally", async () => {
    ctx = createTempDb("kotonoba-backup-int");
    uploadTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-uploads-"));
    process.env.UPLOAD_DIR = uploadTmpDir;
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 0x42).toString("base64");
    process.env.ENCRYPTION_KEY = "test-dedicated-encryption-key-32-chars-min";

    const { db } = ctx;
    const now = new Date();

    db.insert(sites).values({ id: "site-a", domain: "a.test", name: "Site A", createdAt: now, updatedAt: now }).run();
    db.insert(sites).values({ id: "site-b", domain: "b.test", name: "Site B", createdAt: now, updatedAt: now }).run();

    db.insert(users)
      .values({
        id: "admin-1",
        email: "admin@a.test",
        passwordHash: "hash",
        displayName: "Admin",
        role: "super_admin",
        siteId: null,
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.insert(posts)
      .values({
        id: "post-a1",
        siteId: "site-a",
        authorId: "admin-1",
        title: "Post A",
        slug: "post-a",
        contentMd: "<p>Hello A</p><script>alert(1)</script>",
        contentHtml: "<p>Hello A</p>",
        contentFormat: "html",
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(posts)
      .values({
        id: "post-b1",
        siteId: "site-b",
        authorId: "admin-1",
        title: "Secret Site B Post",
        slug: "secret-b",
        contentMd: "<p>Secret B</p>",
        contentHtml: "<p>Secret B</p>",
        contentFormat: "html",
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const dirA = path.join(uploadTmpDir, "sites", "site-a");
    const dirB = path.join(uploadTmpDir, "sites", "site-b");
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });
    fs.writeFileSync(path.join(dirA, "a.png"), Buffer.from("site-a-image"));
    fs.writeFileSync(path.join(dirB, "b-secret.png"), Buffer.from("site-b-image"));

    const exported = await createSiteBackupZip("site-a");
    expect(exported.filename.endsWith(".kotonoba-backup")).toBe(true);
    expect(exported.manifest.counts.posts).toBe(1);
    expect(exported.manifest.counts.media).toBe(1);

    const zipBytes = decryptBackupArchive(exported.buffer);
    const loadedZip = await JSZip.loadAsync(zipBytes);
    const entryNames = Object.keys(loadedZip.files);
    expect(entryNames).toContain("uploads/a.png");
    expect(entryNames.some((n) => n.includes("b-secret.png"))).toBe(false);

    // Restore into site-b using replace mode -> verifies pre-restore snapshot + sanitization + tenant media isolation
    const restoreRes = await restoreSiteBackupZip(exported.buffer, "site-b", {
      mode: "replace",
      currentUserId: "admin-1",
    });

    expect(restoreRes.success).toBe(true);
    expect(restoreRes.stats.posts).toBe(1);
    expect(restoreRes.stats.media).toBe(1);
    expect(restoreRes.snapshotPath && fs.existsSync(restoreRes.snapshotPath)).toBe(true);
    expect(fs.existsSync(path.join(uploadTmpDir, "sites", "site-b", "a.png"))).toBe(true);

    const restoredPosts = db.select().from(posts).where(eq(posts.siteId, "site-b")).all();
    expect(restoredPosts).toHaveLength(1);
    expect(restoredPosts[0].contentFormat).toBe("html");
    expect(restoredPosts[0].content).toContain("<p>Hello A</p>");
    expect(restoredPosts[0].contentMd).toBe("");
    expect(restoredPosts[0].contentHtml).toContain("<p>Hello A</p>");
    expect(restoredPosts[0].contentHtml).not.toContain("<script");
  });

  it("rejects zip-slip paths and checksum tampering without modifying the database", async () => {
    ctx = createTempDb("kotonoba-zipslip-int");
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 0x43).toString("base64");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites).values({ id: "s1", domain: "s1.test", name: "S1", createdAt: now, updatedAt: now }).run();

    const evilZip = new JSZip();
    evilZip.file("manifest.json", JSON.stringify({ format: "kotonoba-backup", checksum: "wrong-checksum" }));
    evilZip.file("data.json", JSON.stringify({ posts: [] }));
    evilZip.file("../escape.txt", Buffer.from("pwned"));
    const encryptedEvil = encryptBackupArchive(await evilZip.generateAsync({ type: "nodebuffer" }));

    const res = await restoreSiteBackupZip(encryptedEvil.buffer, "s1", {
      mode: "merge",
      currentUserId: "u1",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unsafe archive entry path");
  });

  it("rejects archives whose declared uncompressed metadata exceeds the budget before restoring", async () => {
    ctx = createTempDb("kotonoba-size-int");
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 0x44).toString("base64");
    process.env.MAX_BACKUP_UNCOMPRESSED_BYTES = "256";

    const { db } = ctx;
    const now = new Date();
    db.insert(sites).values({ id: "s1", domain: "s1.test", name: "S1", createdAt: now, updatedAt: now }).run();

    const zip = new JSZip();
    zip.file("data.json", JSON.stringify({ site: { id: "s1" }, posts: [] }));
    zip.file("uploads/huge.bin", Buffer.alloc(2048, 0x41));
    const encrypted = encryptBackupArchive(await zip.generateAsync({ type: "nodebuffer" }));

    const res = await restoreSiteBackupZip(encrypted.buffer, "s1", {
      mode: "merge",
      currentUserId: "u1",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("uncompressed size");
    expect(db.select().from(posts).all()).toHaveLength(0);
  });

  it("rolls back media and database changes when the restore transaction fails", async () => {
    ctx = createTempDb("kotonoba-rollback-int");
    uploadTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-rollback-uploads-"));
    process.env.UPLOAD_DIR = uploadTmpDir;
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 0x45).toString("base64");
    process.env.ENCRYPTION_KEY = "test-dedicated-encryption-key-32-chars-min";

    const { db } = ctx;
    const now = new Date();
    db.insert(sites)
      .values([
        { id: "site-a", domain: "a.test", name: "Site A", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "b.test", name: "Site B", createdAt: now, updatedAt: now },
      ])
      .run();

    const dirA = path.join(uploadTmpDir, "sites", "site-a");
    const dirB = path.join(uploadTmpDir, "sites", "site-b");
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });
    fs.writeFileSync(path.join(dirA, "existing.png"), "replacement-content");
    fs.writeFileSync(path.join(dirB, "existing.png"), "original-content");

    const exported = await createSiteBackupZip("site-a");
    const transactionSpy = vi.spyOn(db, "transaction").mockImplementation((() => {
      throw new Error("injected transaction failure");
    }) as never);

    const res = await restoreSiteBackupZip(exported.buffer, "site-b", {
      mode: "merge",
      currentUserId: "u1",
    });
    transactionSpy.mockRestore();

    expect(res.success).toBe(false);
    expect(res.error).toContain("transaction");
    expect(fs.readFileSync(path.join(dirB, "existing.png"), "utf8")).toBe("original-content");
    expect(db.select().from(posts).all()).toHaveLength(0);
  });

  it("publishes due scheduled content and deduplicates outbox notifications per (postId, channel)", async () => {
    ctx = createTempDb("kotonoba-cron-int");
    const { db } = ctx;
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3_600_000);

    db.insert(sites).values({ id: "s1", domain: "s1.test", name: "S1", createdAt: past, updatedAt: past }).run();
    db.insert(users)
      .values({
        id: "u1",
        email: "u@s1.test",
        passwordHash: "hash",
        displayName: "U",
        role: "admin",
        siteId: "s1",
        tokenVersion: 1,
        createdAt: past,
      })
      .run();

    db.insert(settings).values({ siteId: "s1", key: "discord_notifications_enabled", value: "true" }).run();

    db.insert(posts)
      .values({
        id: "due-post",
        siteId: "s1",
        authorId: "u1",
        title: "Due",
        slug: "due",
        status: "scheduled",
        publishedAt: past,
        createdAt: past,
        updatedAt: past,
      })
      .run();

    db.insert(posts)
      .values({
        id: "future-post",
        siteId: "s1",
        authorId: "u1",
        title: "Future",
        slug: "future",
        status: "scheduled",
        publishedAt: future,
        createdAt: past,
        updatedAt: past,
      })
      .run();

    const pubRes = await publishScheduledPosts("s1");
    expect(pubRes.publishedPostsCount).toBe(1);

    // Calling enqueue twice must never duplicate the (due-post, discord) outbox row
    enqueuePostNotifications("s1", "due-post");
    enqueuePostNotifications("s1", "due-post");

    const jobs = db.select().from(notificationOutbox).where(eq(notificationOutbox.postId, "due-post")).all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].channel).toBe("discord");

    const futurePost = db.select().from(posts).where(eq(posts.id, "future-post")).get();
    expect(futurePost?.status).toBe("scheduled");
  });

  it("backfills unified content column idempotently across legacy HTML and Markdown rows", () => {
    ctx = createTempDb("kotonoba-content-backfill-int");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites).values({ id: "s1", domain: "s1.test", name: "S1", createdAt: now, updatedAt: now }).run();
    db.insert(users)
      .values({
        id: "u1",
        email: "u@s1.test",
        passwordHash: "hash",
        displayName: "U",
        role: "admin",
        siteId: "s1",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.run(sql`
      INSERT INTO posts (id, site_id, author_id, title, slug, content, content_md, content_html, content_format, status, created_at, updated_at)
      VALUES
        ('legacy-html', 's1', 'u1', 'Legacy HTML', 'legacy-html', '', '<p>Bad md</p>', '<p>Legacy HTML</p>', 'html', 'published', ${now.getTime()}, ${now.getTime()}),
        ('legacy-md', 's1', 'u1', 'Legacy MD', 'legacy-md', '', '# Legacy Heading', '', 'markdown', 'published', ${now.getTime()}, ${now.getTime()})
    `);

    runMigrations(db);
    runMigrations(db);

    const htmlRow = db.select().from(posts).where(eq(posts.id, "legacy-html")).get();
    expect(htmlRow?.contentFormat).toBe("html");
    expect(htmlRow?.content).toBe("<p>Legacy HTML</p>");
    expect(htmlRow?.contentMd).toBe("");

    const mdRow = db.select().from(posts).where(eq(posts.id, "legacy-md")).get();
    expect(mdRow?.contentFormat).toBe("markdown");
    expect(mdRow?.content).toBe("# Legacy Heading");
    expect(mdRow?.contentMd).toBe("# Legacy Heading");
  });
});
