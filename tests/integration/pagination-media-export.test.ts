import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, pages, settings, auditLogs } from "@/lib/db/schema";
import { signAccessToken } from "@/lib/auth/jwt";
import { eq } from "drizzle-orm";
import { S3Client } from "@aws-sdk/client-s3";
import {
  getCachedPaginatedArchivePosts,
  getPaginatedArchivePosts,
  searchPublicPostsPaginated,
} from "@/lib/queries/public-posts";
import { listMediaFiles } from "@/lib/storage";

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

import { GET as getSelfExport } from "@/app/api/users/me/export/route";

describe("Archive & search pagination, media cursor listing, and self-service user export", () => {
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

  it("paginates public /archive queries and search results strictly within a single tenant", async () => {
    ctx = createTempDb("kotonoba-pagination-int");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values([
        { id: "s1", domain: "s1.test", name: "S1", createdAt: now, updatedAt: now },
        { id: "s2", domain: "s2.test", name: "S2", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(users)
      .values({
        id: "u1",
        email: "author@s1.test",
        passwordHash: "hash",
        displayName: "Author",
        role: "admin",
        siteId: "s1",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    for (let i = 1; i <= 35; i++) {
      const ts = new Date(now.getTime() + i * 1000);
      db.insert(posts)
        .values({
          id: `s1-post-${i}`,
          siteId: "s1",
          authorId: "u1",
          title: `Archive Topic ${i}`,
          slug: `archive-topic-${i}`,
          excerpt: `Summary ${i}`,
          contentMd: "",
          contentHtml: `<p>Body ${i}</p>`,
          contentFormat: "html",
          status: "published",
          publishedAt: ts,
          createdAt: ts,
          updatedAt: ts,
        })
        .run();
    }

    db.insert(posts)
      .values({
        id: "s2-leak-check",
        siteId: "s2",
        authorId: "u1",
        title: "Archive Topic Secret S2",
        slug: "archive-secret-s2",
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const p1 = getPaginatedArchivePosts({ siteId: "s1", page: 1 });
    expect(p1.totalCount).toBe(35);
    expect(p1.totalPages).toBe(2);
    expect(p1.items).toHaveLength(30);

    const p2 = await getCachedPaginatedArchivePosts({ siteId: "s1", page: 2 });
    expect(p2.currentPage).toBe(2);
    expect(p2.items).toHaveLength(5);
    expect(p2.items.some((item) => item.id === "s2-leak-check")).toBe(false);

    const sPage1 = searchPublicPostsPaginated({ siteId: "s1", query: "Archive Topic", page: 1, limit: 20 });
    expect(sPage1.totalCount).toBe(35);
    expect(sPage1.totalPages).toBe(2);
    expect(sPage1.hasMore).toBe(true);
    expect(sPage1.items).toHaveLength(20);

    const sPage2 = searchPublicPostsPaginated({ siteId: "s1", query: "Archive Topic", page: 2, limit: 20 });
    expect(sPage2.hasMore).toBe(false);
    expect(sPage2.items).toHaveLength(15);
    expect(sPage2.items.some((item) => item.id === "s2-leak-check")).toBe(false);
  });

  it("supports deterministic cursor pagination on local disk and S3ContinuationToken backends", async () => {
    ctx = createTempDb("kotonoba-media-cursor-int");
    uploadTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotonoba-media-cursor-"));
    vi.stubEnv("UPLOAD_DIR", uploadTmpDir);

    const { db } = ctx;
    const now = new Date();
    db.insert(sites).values({ id: "s1", domain: "s1.test", name: "S1", createdAt: now, updatedAt: now }).run();

    const siteDir = path.join(uploadTmpDir, "sites", "s1");
    fs.mkdirSync(siteDir, { recursive: true });
    for (let i = 1; i <= 5; i++) {
      const target = path.join(siteDir, `img-${i}.png`);
      fs.writeFileSync(target, Buffer.from(`png-${i}`));
      const t = new Date(1_700_000_000_000 + i * 10_000);
      fs.utimesSync(target, t, t);
    }

    const page1 = await listMediaFiles("", "s1", { limit: 2 });
    expect(page1.files).toHaveLength(2);
    expect(page1.nextCursor).toBe("2");

    const page2 = await listMediaFiles("", "s1", { cursor: page1.nextCursor, limit: 2 });
    expect(page2.files).toHaveLength(2);
    expect(page2.nextCursor).toBe("4");

    const page3 = await listMediaFiles("", "s1", { cursor: page2.nextCursor, limit: 2 });
    expect(page3.files).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    const combinedPaths = [...page1.files, ...page2.files, ...page3.files].map((f) => f.path);
    expect(new Set(combinedPaths).size).toBe(5);

    // Mock S3/R2 paginated response forwarding ContinuationToken
    db.insert(settings)
      .values([
        { siteId: "s1", key: "storage_provider", value: "s3" },
        { siteId: "s1", key: "s3_bucket", value: "tenant-bucket" },
        { siteId: "s1", key: "s3_access_key", value: "AKIA_TEST" },
        { siteId: "s1", key: "s3_secret_key", value: "SECRET_TEST" },
      ])
      .run();

    const sendSpy = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
      const token = (command as { input?: { ContinuationToken?: string } }).input?.ContinuationToken;
      if (!token) {
        return {
          Contents: [
            { Key: "sites/s1/a.png", Size: 10, LastModified: new Date("2026-01-02T00:00:00Z") },
            { Key: "sites/s1/b.png", Size: 20, LastModified: new Date("2026-01-01T00:00:00Z") },
          ],
          IsTruncated: true,
          NextContinuationToken: "s3-cursor-2",
        } as never;
      }
      expect(token).toBe("s3-cursor-2");
      return {
        Contents: [{ Key: "sites/s1/c.png", Size: 30, LastModified: new Date("2025-12-31T00:00:00Z") }],
        IsTruncated: false,
      } as never;
    });

    const s3First = await listMediaFiles("", "s1", { limit: 2 });
    expect(s3First.files.map((f) => f.filename)).toEqual(["a.png", "b.png"]);
    expect(s3First.nextCursor).toBe("s3-cursor-2");

    const s3Second = await listMediaFiles("", "s1", { cursor: s3First.nextCursor, limit: 2 });
    expect(s3Second.files.map((f) => f.filename)).toEqual(["c.png"]);
    expect(s3Second.nextCursor).toBeNull();
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it("exports only the authenticated user's profile and authored content without password hashes", async () => {
    ctx = createTempDb("kotonoba-self-export-int");
    vi.stubEnv("JWT_SECRET", "test-jwt-secret-key-minimum-32-chars!!");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites).values({ id: "s1", domain: "site-a.test", name: "Site A", createdAt: now, updatedAt: now }).run();
    db.insert(users)
      .values([
        {
          id: "u-me",
          email: "me@site-a.test",
          passwordHash: "secret-argon-hash",
          displayName: "Me Author",
          role: "author",
          siteId: "s1",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "u-other",
          email: "other@site-a.test",
          passwordHash: "other-argon-hash",
          displayName: "Other Author",
          role: "editor",
          siteId: "s1",
          tokenVersion: 1,
          createdAt: now,
        },
      ])
      .run();

    db.insert(posts)
      .values([
        {
          id: "p-mine",
          siteId: "s1",
          authorId: "u-me",
          title: "My Post",
          slug: "my-post",
          contentHtml: "<p>Mine</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "p-other",
          siteId: "s1",
          authorId: "u-other",
          title: "Other Post",
          slug: "other-post",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    db.insert(pages)
      .values({
        id: "pg-mine",
        siteId: "s1",
        authorId: "u-me",
        title: "My Page",
        slug: "my-page",
        contentHtml: "<p>Page body</p>",
        contentMd: "",
        contentFormat: "html",
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const unauthRes = await getSelfExport(new NextRequest("https://site-a.test/api/users/me/export"));
    expect(unauthRes.status).toBe(401);

    mockAuthState.accessToken = await signAccessToken({
      userId: "u-me",
      email: "me@site-a.test",
      role: "author",
      siteId: "s1",
      tokenVersion: 1,
    });

    const okRes = await getSelfExport(new NextRequest("https://site-a.test/api/users/me/export"));
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("content-disposition")).toContain("attachment;");

    const body = (await okRes.json()) as {
      account: Record<string, unknown>;
      authoredPosts: Array<{ id: string }>;
      authoredPages: Array<{ id: string }>;
    };

    expect(body.account.id).toBe("u-me");
    expect(body.account.email).toBe("me@site-a.test");
    expect("passwordHash" in body.account).toBe(false);
    expect(body.authoredPosts.map((p) => p.id)).toEqual(["p-mine"]);
    expect(body.authoredPages.map((p) => p.id)).toEqual(["pg-mine"]);

    const audits = db.select().from(auditLogs).where(eq(auditLogs.action, "user.self_export")).all();
    expect(audits).toHaveLength(1);
  });
});
