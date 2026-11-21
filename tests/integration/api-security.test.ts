import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, settings, analytics, auditLogs } from "@/lib/db/schema";
import { signAccessToken } from "@/lib/auth/jwt";
import { eq, and } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const mockAuthState = vi.hoisted(() => ({
  host: "site-a.test",
  accessToken: "",
  adminSiteCookie: "",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mockAuthState.host }),
  cookies: async () => ({
    get: (name: string) => {
      if (name === "access_token" && mockAuthState.accessToken) {
        return { value: mockAuthState.accessToken };
      }
      if (name === "kotonoba_admin_site_id" && mockAuthState.adminSiteCookie) {
        return { value: mockAuthState.adminSiteCookie };
      }
      return undefined;
    },
  }),
}));

import { POST as postUpload } from "@/app/api/upload/route";
import { GET as getUploadedFile } from "@/app/api/uploads/[...path]/route";
import { GET as getFavicon } from "@/app/api/favicon/route";
import { GET as getMedia, POST as postMedia, DELETE as deleteMedia } from "@/app/api/media/route";
import { GET as exportBackup } from "@/app/api/backup/export/route";
import { POST as importBackup } from "@/app/api/backup/import/route";
import { GET as getRealtimeAnalytics } from "@/app/api/analytics/realtime/route";
import { POST as postAnalyticsHit } from "@/app/api/analytics/hit/route";
import { GET as getAnalyticsPixel } from "@/app/api/analytics/pixel/route";
import { GET as getUpdates } from "@/app/api/updates/route";
import * as categoryActions from "@/actions/categories";

const VALID_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("HTTP API endpoint security, tenant isolation, uploads, backups & analytics", () => {
  let ctx: TempDbContext | null = null;
  let uploadTmpDir: string | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockAuthState.host = "site-a.test";
    mockAuthState.accessToken = "";
    mockAuthState.adminSiteCookie = "";
    ctx?.cleanup();
    ctx = null;
    if (uploadTmpDir) {
      fs.rmSync(uploadTmpDir, { recursive: true, force: true });
      uploadTmpDir = null;
    }
  });

  function setupFixtures() {
    ctx = createTempDb("kotonoba-api-sec");
    uploadTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-api-uploads-"));
    vi.stubEnv("UPLOAD_DIR", uploadTmpDir);
    vi.stubEnv("JWT_SECRET", "test-jwt-secret-key-minimum-32-chars!!");
    vi.stubEnv("ENCRYPTION_KEY", "test-enc-secret-key-minimum-32-chars!!");
    vi.stubEnv("BACKUP_ENCRYPTION_KEY", Buffer.alloc(32, 0x33).toString("base64"));

    const now = new Date();
    const { db } = ctx;

    db.insert(sites)
      .values([
        { id: "site-a", domain: "site-a.test", name: "Site A", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "site-b.test", name: "Site B", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(users)
      .values([
        {
          id: "admin-a",
          email: "admin@a.test",
          passwordHash: "hash",
          displayName: "Admin A",
          role: "admin",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "author-a",
          email: "author@a.test",
          passwordHash: "hash",
          displayName: "Author A",
          role: "author",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
      ])
      .run();

    db.insert(posts)
      .values([
        {
          id: "post-a",
          siteId: "site-a",
          authorId: "admin-a",
          title: "Post A",
          slug: "post-a",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "post-b",
          siteId: "site-b",
          authorId: "admin-a",
          title: "Post B",
          slug: "post-b",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    return db;
  }

  async function loginAs(userId: string, email: string, role: string, siteId: string | null) {
    mockAuthState.accessToken = await signAccessToken({
      userId,
      email,
      role,
      siteId,
      tokenVersion: 1,
    });
  }

  it("enforces same-origin, authz, magic-byte validation, tenant scoping & traversal guards on upload/media endpoints", async () => {
    setupFixtures();

    // Unauthenticated rejected
    const noAuthForm = new FormData();
    noAuthForm.append("file", new File([VALID_PNG_BYTES], "test.png", { type: "image/png" }));
    const unauthRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: noAuthForm,
      })
    );
    expect(unauthRes.status).toBe(401);

    await loginAs("admin-a", "admin@a.test", "admin", "site-a");

    // Cross-origin rejected
    const csrfForm = new FormData();
    csrfForm.append("file", new File([VALID_PNG_BYTES], "test.png", { type: "image/png" }));
    const csrfRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://evil.test" },
        body: csrfForm,
      })
    );
    expect(csrfRes.status).toBe(403);

    // Cross-tenant siteId rejected even for valid PNG
    const crossTenantForm = new FormData();
    crossTenantForm.append("file", new File([VALID_PNG_BYTES], "test.png", { type: "image/png" }));
    crossTenantForm.append("siteId", "site-b");
    const crossTenantRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: crossTenantForm,
      })
    );
    expect(crossTenantRes.status).toBe(403);

    // Executable SVG rejected
    const svgForm = new FormData();
    svgForm.append("file", new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "xss.svg", { type: "image/svg+xml" }));
    const svgRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: svgForm,
      })
    );
    expect(svgRes.status).toBe(400);

    // PNG bytes with spoofed image/jpeg MIME rejected
    const mismatchForm = new FormData();
    mismatchForm.append("file", new File([VALID_PNG_BYTES], "spoof.jpg", { type: "image/jpeg" }));
    const mismatchRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: mismatchForm,
      })
    );
    expect(mismatchRes.status).toBe(400);

    // Valid upload lands strictly under sites/site-a/... and serves with nosniff
    const validForm = new FormData();
    validForm.append("file", new File([VALID_PNG_BYTES], "banner.png", { type: "image/png" }));
    validForm.append("folder", "covers");
    const validRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: validForm,
      })
    );
    expect(validRes.status).toBe(200);
    const uploadJson = await validRes.json();
    expect(uploadJson.url).toMatch(/^\/api\/uploads\/sites\/site-a\/covers\//);
    expect(uploadJson.path).toMatch(/^covers\//);
    expect(fs.existsSync(path.join(uploadTmpDir!, "sites", "site-a", uploadJson.path))).toBe(true);

    // Download endpoint blocks traversal and dotfiles
    const traversalRes = await getUploadedFile(new NextRequest("https://site-a.test/api/uploads/..%2Fsecret"), {
      params: Promise.resolve({ path: ["..", "secret"] }),
    });
    expect(traversalRes.status).toBe(404);

    // Legacy SVG on disk gets strict CSP sandbox headers
    const legacySvgDir = path.join(uploadTmpDir!, "sites", "site-a", "legacy");
    fs.mkdirSync(legacySvgDir, { recursive: true });
    fs.writeFileSync(path.join(legacySvgDir, "logo.svg"), "<svg></svg>", "utf8");
    const legacySvgRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/legacy/logo.svg"),
      { params: Promise.resolve({ path: ["sites", "site-a", "legacy", "logo.svg"] }) }
    );
    expect(legacySvgRes.status).toBe(200);
    expect(legacySvgRes.headers.get("content-security-policy")).toContain("sandbox");
    expect(legacySvgRes.headers.get("x-content-type-options")).toBe("nosniff");

    // Media API enforces site scope and blocks author from mutations
    const listMediaRes = await getMedia(new NextRequest("https://site-a.test/api/media?folder=covers&siteId=site-a"));
    expect(listMediaRes.status).toBe(200);
    const listCrossRes = await getMedia(new NextRequest("https://site-a.test/api/media?siteId=site-b"));
    expect(listCrossRes.status).toBe(403);

    await loginAs("author-a", "author@a.test", "author", "site-a");
    const authorCreateFolderRes = await postMedia(
      new NextRequest("https://site-a.test/api/media", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test", "content-type": "application/json" },
        body: JSON.stringify({ action: "createFolder", folderName: "illegal" }),
      })
    );
    expect(authorCreateFolderRes.status).toBe(403);

    const authorDeleteRes = await deleteMedia(
      new NextRequest("https://site-a.test/api/media", {
        method: "DELETE",
        headers: { host: "site-a.test", origin: "https://site-a.test", "content-type": "application/json" },
        body: JSON.stringify({ path: uploadJson.path, isFolder: false }),
      })
    );
    expect(authorDeleteRes.status).toBe(403);

    // Corrupted truncated PNG rejected cleanly by sharp decoder
    await loginAs("admin-a", "admin@a.test", "admin", "site-a");
    const corruptForm = new FormData();
    corruptForm.append(
      "file",
      new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "corrupt.png", {
        type: "image/png",
      })
    );
    const corruptRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: corruptForm,
      })
    );
    expect(corruptRes.status).toBe(400);

    // Per-tenant storage quota returns HTTP 413 when exceeded
    vi.stubEnv("MAX_SITE_STORAGE_BYTES", "10");
    const overQuotaForm = new FormData();
    overQuotaForm.append("file", new File([VALID_PNG_BYTES], "over.png", { type: "image/png" }));
    const overQuotaRes = await postUpload(
      new NextRequest("https://site-a.test/api/upload", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: overQuotaForm,
      })
    );
    expect(overQuotaRes.status).toBe(413);
    vi.unstubAllEnvs();
    vi.stubEnv("UPLOAD_DIR", uploadTmpDir!);
    vi.stubEnv("JWT_SECRET", "test-jwt-secret-key-minimum-32-chars!!");
    vi.stubEnv("ENCRYPTION_KEY", "test-enc-secret-key-minimum-32-chars!!");
    vi.stubEnv("BACKUP_ENCRYPTION_KEY", Buffer.alloc(32, 0x33).toString("base64"));

    // Orphan cleanup deletes unreferenced uploaded asset while leaving directory clean
    const cleanupRes = await postMedia(
      new NextRequest("https://site-a.test/api/media", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test", "content-type": "application/json" },
        body: JSON.stringify({ action: "cleanupOrphans", gracePeriodMs: 0 }),
      })
    );
    expect(cleanupRes.status).toBe(200);
    const cleanupJson = await cleanupRes.json();
    expect(cleanupJson.deletedCount).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(uploadTmpDir!, "sites", "site-a", uploadJson.path))).toBe(false);
  });

  it("enforces backup role & tenant boundaries, logs denied audits, and round-trips via API routes", async () => {
    const db = setupFixtures();

    // Author denied backup export
    await loginAs("author-a", "author@a.test", "author", "site-a");
    const authorExport = await exportBackup(new NextRequest("https://site-a.test/api/backup/export?siteId=site-a"));
    expect(authorExport.status).toBe(401);

    // Admin A denied exporting Site B and records denied audit log
    await loginAs("admin-a", "admin@a.test", "admin", "site-a");
    const crossExport = await exportBackup(new NextRequest("https://site-a.test/api/backup/export?siteId=site-b"));
    expect(crossExport.status).toBe(403);
    const deniedAudits = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.status, "denied"))
      .all();
    expect(deniedAudits.some((a) => a.action === "backup.export" && a.siteId === "site-b")).toBe(true);

    // Admin A exports Site A encrypted backup successfully
    const okExport = await exportBackup(new NextRequest("https://site-a.test/api/backup/export?siteId=site-a"));
    expect(okExport.status).toBe(200);
    expect(okExport.headers.get("content-disposition")).toContain(".kotonoba-backup");
    const archiveBytes = Buffer.from(await okExport.arrayBuffer());

    // Cross-origin backup import rejected
    const badOriginForm = new FormData();
    badOriginForm.append("siteId", "site-a");
    badOriginForm.append("mode", "merge");
    badOriginForm.append("backup", new File([archiveBytes], "site-a.kotonoba-backup"));
    const csrfImport = await importBackup(
      new NextRequest("https://site-a.test/api/backup/import", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://evil.test" },
        body: badOriginForm,
      })
    );
    expect(csrfImport.status).toBe(403);

    // Admin A cannot import backup into Site B
    const crossImportForm = new FormData();
    crossImportForm.append("siteId", "site-b");
    crossImportForm.append("mode", "merge");
    crossImportForm.append("backup", new File([archiveBytes], "site-a.kotonoba-backup"));
    const crossImportRes = await importBackup(
      new NextRequest("https://site-a.test/api/backup/import", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: crossImportForm,
      })
    );
    expect(crossImportRes.status).toBe(403);

    // Same-site backup import succeeds cleanly
    const okImportForm = new FormData();
    okImportForm.append("siteId", "site-a");
    okImportForm.append("mode", "merge");
    okImportForm.append("backup", new File([archiveBytes], "site-a.kotonoba-backup"));
    const okImportRes = await importBackup(
      new NextRequest("https://site-a.test/api/backup/import", {
        method: "POST",
        headers: { host: "site-a.test", origin: "https://site-a.test" },
        body: okImportForm,
      })
    );
    expect(okImportRes.status).toBe(200);
    const importJson = await okImportRes.json();
    expect(importJson.success).toBe(true);
  });

  it("enforces realtime authz and hit host/post tenant validation in analytics API", async () => {
    const db = setupFixtures();

    // Unauthenticated realtime rejected
    const unauthRealtime = await getRealtimeAnalytics(
      new NextRequest("https://site-a.test/api/analytics/realtime?siteId=site-a")
    );
    expect(unauthRealtime.status).toBe(401);

    // Cross-tenant realtime rejected
    await loginAs("admin-a", "admin@a.test", "admin", "site-a");
    const crossRealtime = await getRealtimeAnalytics(
      new NextRequest("https://site-a.test/api/analytics/realtime?siteId=site-b")
    );
    expect(crossRealtime.status).toBe(403);

    const okRealtime = await getRealtimeAnalytics(
      new NextRequest("https://site-a.test/api/analytics/realtime?siteId=site-a")
    );
    expect(okRealtime.status).toBe(200);

    // Analytics hit rejects spoofed siteId for current Host
    const mismatchHit = await postAnalyticsHit(
      new NextRequest("https://site-a.test/api/analytics/hit", {
        method: "POST",
        headers: { "user-agent": "Mozilla/5.0", "content-type": "application/json" },
        body: JSON.stringify({ siteId: "site-b", path: "/entry/post-b" }),
      })
    );
    expect(mismatchHit.status).toBe(403);

    // Analytics hit rejects postId belonging to another site
    const foreignPostHit = await postAnalyticsHit(
      new NextRequest("https://site-a.test/api/analytics/hit", {
        method: "POST",
        headers: { "user-agent": "Mozilla/5.0", "content-type": "application/json" },
        body: JSON.stringify({ siteId: "site-a", postId: "post-b", path: "/entry/post-a" }),
      })
    );
    expect(foreignPostHit.status).toBe(400);

    // Valid hit inserts analytics row
    const validHit = await postAnalyticsHit(
      new NextRequest("https://site-a.test/api/analytics/hit", {
        method: "POST",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "content-type": "application/json",
          "x-real-ip": "203.0.113.10",
        },
        body: JSON.stringify({ siteId: "site-a", postId: "post-a", path: "/entry/post-a" }),
      })
    );
    expect(validHit.status).toBe(200);
    const hitJson = await validHit.json();
    expect(hitJson.success).toBe(true);
    expect(hitJson.ignored).toBeUndefined();
    const rows = db.select().from(analytics).where(eq(analytics.siteId, "site-a")).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].postId).toBe("post-a");

    // Replaying same hit within 15-minute window is deduplicated
    const replayHit = await postAnalyticsHit(
      new NextRequest("https://site-a.test/api/analytics/hit", {
        method: "POST",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "content-type": "application/json",
          "x-real-ip": "203.0.113.10",
        },
        body: JSON.stringify({ siteId: "site-a", postId: "post-a", path: "/entry/post-a" }),
      })
    );
    expect(replayHit.status).toBe(200);
    const replayJson = await replayHit.json();
    expect(replayJson.ignored).toBe("duplicate_window");
  });

  it("binds tracking pixels to the request host and sanitizes campaign tokens", async () => {
    const db = setupFixtures();

    // Cross-tenant pixel still returns a GIF but records nothing for Site B.
    const crossPixel = await getAnalyticsPixel(
      new NextRequest("https://site-a.test/api/analytics/pixel?sid=site-b&src=newsletter")
    );
    expect(crossPixel.status).toBe(200);
    expect(crossPixel.headers.get("content-type")).toBe("image/gif");
    expect(db.select().from(analytics).all()).toHaveLength(0);

    // Campaign tokens are reduced to a safe path segment.
    const validPixel = await getAnalyticsPixel(
      new NextRequest(
        "https://site-a.test/api/analytics/pixel?sid=site-a&src=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
      )
    );
    expect(validPixel.status).toBe(200);

    const rows = db.select().from(analytics).where(eq(analytics.siteId, "site-a")).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe("/pixel/scriptalert1script");
    expect(rows[0].utmCampaign).toBe("scriptalert1script");
    expect(rows[0].path).not.toContain("<");
  });

  it("fails analytics ingestion closed for unknown hosts in production", async () => {
    const db = setupFixtures();
    vi.stubEnv("NODE_ENV", "production");
    mockAuthState.host = "unknown.test";

    const res = await postAnalyticsHit(
      new NextRequest("https://unknown.test/api/analytics/hit", {
        method: "POST",
        headers: {
          host: "unknown.test",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "content-type": "application/json",
          "x-real-ip": "203.0.113.44",
        },
        body: JSON.stringify({ siteId: "site-a", path: "/entry/post-a" }),
      })
    );

    expect(res.status).toBe(404);
    expect(db.select().from(analytics).all()).toHaveLength(0);
  });

  it("proxies R2/S3 assets on /api/uploads/* and /api/favicon directly without 307 redirects", async () => {
    const db = setupFixtures();
    db.insert(settings)
      .values([
        { siteId: "site-a", key: "storage_provider", value: "r2" },
        { siteId: "site-a", key: "s3_bucket", value: "private-media-bucket" },
        { siteId: "site-a", key: "s3_access_key", value: "test-r2-access" },
        { siteId: "site-a", key: "s3_secret_key", value: "test-r2-secret" },
        { siteId: "site-a", key: "s3_endpoint", value: "https://acct.r2.cloudflarestorage.com" },
        { siteId: "site-a", key: "s3_public_url", value: "https://pub-12345.r2.dev" },
      ])
      .run();

    const sendSpy = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (!(command instanceof GetObjectCommand)) {
        throw new Error("Unexpected S3 command");
      }
      const key = command.input.Key;
      if (command.input.IfNoneMatch === '"etag-png-1"') {
        const notModifiedErr = Object.assign(new Error("NotModified"), {
          name: "NotModified",
          $metadata: { httpStatusCode: 304 },
        });
        throw notModifiedErr;
      }
      if (key === "sites/site-a/covers/pic.png" || key === "sites/site-a/brand/icon.png") {
        return {
          Body: {
            transformToWebStream: () =>
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array(VALID_PNG_BYTES));
                  controller.close();
                },
              }),
          },
          ContentLength: VALID_PNG_BYTES.byteLength,
          ETag: '"etag-png-1"',
          $metadata: { httpStatusCode: 200 },
        } as never;
      }
      if (key === "sites/site-a/legacy/badge.svg") {
        const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array(svgBytes),
          },
          ContentLength: svgBytes.byteLength,
          ETag: '"etag-svg-1"',
          $metadata: { httpStatusCode: 200 },
        } as never;
      }
      throw Object.assign(new Error("NoSuchKey"), {
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      });
    });

    // Even when s3_public_url is configured, /api/uploads/* stays on the site domain (200, never 307)
    const pngRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/covers/pic.png"),
      { params: Promise.resolve({ path: ["sites", "site-a", "covers", "pic.png"] }) }
    );
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers.get("location")).toBeNull();
    expect(pngRes.headers.get("content-type")).toBe("image/png");
    expect(pngRes.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(pngRes.headers.get("x-content-type-options")).toBe("nosniff");
    expect(pngRes.headers.get("etag")).toBe('"etag-png-1"');
    expect(Buffer.from(await pngRes.arrayBuffer())).toEqual(VALID_PNG_BYTES);

    // Works identically for private buckets with blank s3_public_url (no presigned 307 redirect)
    db.delete(settings)
      .where(and(eq(settings.siteId, "site-a"), eq(settings.key, "s3_public_url")))
      .run();
    const privateRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/covers/pic.png"),
      { params: Promise.resolve({ path: ["sites", "site-a", "covers", "pic.png"] }) }
    );
    expect(privateRes.status).toBe(200);
    expect(privateRes.headers.get("location")).toBeNull();
    expect(Buffer.from(await privateRes.arrayBuffer())).toEqual(VALID_PNG_BYTES);

    // Conditional ETag check -> 304 Not Modified without redirecting
    const notModifiedRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/covers/pic.png", {
        headers: { "if-none-match": '"etag-png-1"' },
      }),
      { params: Promise.resolve({ path: ["sites", "site-a", "covers", "pic.png"] }) }
    );
    expect(notModifiedRes.status).toBe(304);
    expect(notModifiedRes.headers.get("location")).toBeNull();

    // SVG from R2 retains strict CSP sandbox headers
    const svgRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/legacy/badge.svg"),
      { params: Promise.resolve({ path: ["sites", "site-a", "legacy", "badge.svg"] }) }
    );
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get("content-type")).toBe("image/svg+xml");
    expect(svgRes.headers.get("content-security-policy")).toContain("sandbox");
    expect(svgRes.headers.get("content-disposition")).toBe("inline");

    // Missing R2 key returns 404
    const missingRes = await getUploadedFile(
      new NextRequest("https://site-a.test/api/uploads/sites/site-a/covers/missing.png"),
      { params: Promise.resolve({ path: ["sites", "site-a", "covers", "missing.png"] }) }
    );
    expect(missingRes.status).toBe(404);

    // /api/favicon also serves R2-hosted /api/uploads/* icons directly without 307 redirect
    db.update(sites)
      .set({ faviconUrl: "/api/uploads/sites/site-a/brand/icon.png" })
      .where(eq(sites.id, "site-a"))
      .run();
    const faviconRes = await getFavicon(new NextRequest("https://site-a.test/api/favicon"));
    expect(faviconRes.status).toBe(200);
    expect(faviconRes.headers.get("location")).toBeNull();
    expect(faviconRes.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await faviconRes.arrayBuffer())).toEqual(VALID_PNG_BYTES);

    expect(sendSpy).toHaveBeenCalled();
  });

  it("requires authenticated admin session on GET /api/updates and does not expose unauthenticated category server actions", async () => {
    ctx = createTempDb("kotonoba-updates-auth");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values({ id: "site-a", domain: "site-a.test", name: "Site A", createdAt: now, updatedAt: now })
      .run();

    db.insert(users)
      .values([
        {
          id: "u-author",
          email: "author@site-a.test",
          passwordHash: "hash",
          displayName: "Author",
          role: "author",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "u-admin",
          email: "admin@site-a.test",
          passwordHash: "hash",
          displayName: "Admin",
          role: "admin",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
      ])
      .run();

    // Unauthenticated caller cannot fingerprint app version
    const unauthRes = await getUpdates();
    expect(unauthRes.status).toBe(401);

    // Non-admin role (author) is denied 403
    vi.stubEnv("JWT_SECRET", "test-jwt-secret-key-minimum-32-chars!!");
    await loginAs("u-author", "author@site-a.test", "author", "site-a");
    const authorRes = await getUpdates();
    expect(authorRes.status).toBe(403);

    // Admin is permitted and returns UpdateInfo cleanly without leaking external requests when offline
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline test"));
    await loginAs("u-admin", "admin@site-a.test", "admin", "site-a");
    const adminRes = await getUpdates();
    expect(adminRes.status).toBe(200);
    const body = await adminRes.json();
    expect(typeof body.currentVersion).toBe("string");
    expect(typeof body.updateAvailable).toBe("boolean");

    // Server Action module must no longer export unauthenticated getPublicCategories
    expect("getPublicCategories" in categoryActions).toBe(false);
  });
});
