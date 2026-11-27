import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, pages, categories, tags, settings, analytics } from "@/lib/db/schema";
import type { TokenPayload } from "@/lib/auth/jwt";
import { createPostService, getExistingPostMeta, updatePostService, deletePostService } from "@/lib/services/posts";
import { deletePageService } from "@/lib/services/pages";
import { createUserService, updateUserService, deleteUserService } from "@/lib/services/users";
import {
  getRedactedSiteSettings,
  saveSiteSettingsService,
  clearSiteSecretSettingService,
} from "@/lib/services/settings";
import { createCategoryService, createTagService } from "@/lib/services/taxonomy";
import { listAuditLogsForActor } from "@/lib/services/audit";
import { recordAuditEvent } from "@/lib/security/audit";

describe("Domain services authorization, uniqueness, and secret encryption", () => {
  let ctx: TempDbContext | null = null;
  const origEnc = process.env.ENCRYPTION_KEY;
  const origJwt = process.env.JWT_SECRET;

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
    if (origEnc !== undefined) process.env.ENCRYPTION_KEY = origEnc;
    else delete process.env.ENCRYPTION_KEY;
    if (origJwt !== undefined) process.env.JWT_SECRET = origJwt;
    else delete process.env.JWT_SECRET;
  });

  function seedBaseTenants() {
    ctx = createTempDb("kotonoba-services-int");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values([
        { id: "site-a", domain: "a.test", name: "Site A", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "b.test", name: "Site B", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(users)
      .values([
        {
          id: "super-1",
          email: "super@test.com",
          passwordHash: "hash",
          displayName: "Super",
          role: "super_admin",
          siteId: null,
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "admin-a",
          email: "admin-a@test.com",
          passwordHash: "hash",
          displayName: "Admin A",
          role: "admin",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "admin-a2",
          email: "admin-a2@test.com",
          passwordHash: "hash",
          displayName: "Admin A2",
          role: "admin",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "author-a1",
          email: "author1@test.com",
          passwordHash: "hash",
          displayName: "Author 1",
          role: "author",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "author-a2",
          email: "author2@test.com",
          passwordHash: "hash",
          displayName: "Author 2",
          role: "author",
          siteId: "site-a",
          tokenVersion: 1,
          createdAt: now,
        },
      ])
      .run();

    return db;
  }

  it("enforces author ownership, XSS sanitization, and tenant taxonomy boundaries in posts service", async () => {
    const db = seedBaseTenants();

    const catA = createCategoryService("site-a", { name: "News", slug: "news", description: "", sortOrder: 0 });
    const catB = createCategoryService("site-b", { name: "Other", slug: "other", description: "", sortOrder: 0 });
    const tagA = createTagService("site-a", { name: "Release", slug: "release" });
    expect(catA.success && catB.success && tagA.success).toBe(true);

    const author1Token: TokenPayload = {
      userId: "author-a1",
      email: "author1@test.com",
      role: "author",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const author2Token: TokenPayload = {
      userId: "author-a2",
      email: "author2@test.com",
      role: "author",
      siteId: "site-a",
      tokenVersion: 1,
    };

    // Rejects taxonomy from site-b when creating a post in site-a
    const badTax = await createPostService(author1Token, "site-a", {
      title: "Cross-tenant taxonomy",
      slug: "cross-tax",
      excerpt: "",
      contentMd: "<p>Hi</p>",
      contentHtml: "<p>Hi</p>",
      status: "draft",
      locale: "en",
      pinned: false,
      categoryIds: [catB.success ? catB.id! : ""],
      tagIds: [],
    });
    expect(badTax.result.success).toBe(false);

    // Sanitizes HTML payload on save and creates post successfully
    const created = await createPostService(author1Token, "site-a", {
      title: "Launch Post",
      slug: "launch-post",
      excerpt: "",
      contentMd: "<p>Safe</p><script>alert(1)</script>",
      contentHtml: "<p>Safe</p><script>alert(1)</script>",
      status: "published",
      locale: "en",
      pinned: false,
      categoryIds: [catA.success ? catA.id! : ""],
      tagIds: [tagA.success ? tagA.id : ""],
    });
    expect(created.result.success).toBe(true);
    const createdId = created.result.success ? created.result.postId : "";

    const stored = db.select().from(posts).where(eq(posts.id, createdId)).get();
    expect(stored?.contentHtml).toContain("Safe");
    expect(stored?.contentHtml).not.toContain("<script");
    expect(stored?.contentFormat).toBe("html");

    // Author 2 cannot edit Author 1's post
    const meta = getExistingPostMeta(createdId)!;
    const deniedEdit = await updatePostService(author2Token, meta, {
      title: "Hijacked",
      slug: "launch-post",
      excerpt: "",
      contentMd: "<p>Owned</p>",
      contentHtml: "<p>Owned</p>",
      status: "published",
      locale: "en",
      pinned: false,
      categoryIds: [],
      tagIds: [],
    });
    expect(deniedEdit.result.success).toBe(false);

    const authorPinnedCreate = await createPostService(author1Token, "site-a", {
      title: "Pinned Attempt",
      slug: "pinned-attempt",
      excerpt: "",
      contentMd: "<p>Pinned</p>",
      contentHtml: "<p>Pinned</p>",
      status: "published",
      locale: "en",
      pinned: true,
      categoryIds: [],
      tagIds: [],
    });
    expect(authorPinnedCreate.result.success).toBe(false);

    const authorPinChange = await updatePostService(author1Token, meta, {
      title: "Launch Post",
      slug: "launch-post",
      excerpt: "",
      contentMd: "<p>Safe</p>",
      contentHtml: "<p>Safe</p>",
      status: "published",
      locale: "en",
      pinned: true,
      categoryIds: [catA.success ? catA.id! : ""],
      tagIds: [tagA.success ? tagA.id : ""],
    });
    expect(authorPinChange.result.success).toBe(false);

    const adminToken: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };

    const adminPin = await updatePostService(adminToken, meta, {
      title: "Launch Post",
      slug: "launch-post",
      excerpt: "",
      contentMd: "<p>Safe</p>",
      contentHtml: "<p>Safe</p>",
      status: "published",
      locale: "en",
      pinned: true,
      categoryIds: [catA.success ? catA.id! : ""],
      tagIds: [tagA.success ? tagA.id : ""],
    });
    expect(adminPin.result.success).toBe(true);

    await deletePostService(adminToken, createdId);
    expect(db.select().from(posts).where(eq(posts.id, createdId)).get()).toBeUndefined();
    expect(db.select().from(categories).where(eq(categories.siteId, "site-a")).all()).toHaveLength(1);
    expect(db.select().from(tags).where(eq(tags.siteId, "site-a")).all()).toHaveLength(1);
  });

  it("prevents privilege escalation in user service and bumps tokenVersion on role or password change", async () => {
    const db = seedBaseTenants();

    const siteAdmin: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const superAdmin: TokenPayload = {
      userId: "super-1",
      email: "super@test.com",
      role: "super_admin",
      siteId: null,
      tokenVersion: 1,
    };

    const escalate = await createUserService(siteAdmin, {
      email: "rogue@test.com",
      displayName: "Rogue",
      password: "StrongPassword123",
      role: "super_admin",
      siteId: "site-a",
    });
    expect(escalate.success).toBe(false);

    const updated = await updateUserService(superAdmin, "author-a1", {
      role: "editor",
      siteId: "site-b",
    });
    expect(updated.success).toBe(true);

    const refreshed = db.select().from(users).where(eq(users.id, "author-a1")).get();
    expect(refreshed?.role).toBe("editor");
    expect(refreshed?.siteId).toBe("site-b");
    expect(refreshed?.tokenVersion).toBe(2);

    const selfDelete = deleteUserService(superAdmin, "super-1");
    expect(selfDelete.success).toBe(false);
  });

  it("blocks lateral admin takeover and protects the last site administrator", async () => {
    const db = seedBaseTenants();

    const siteAdmin: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const superAdmin: TokenPayload = {
      userId: "super-1",
      email: "super@test.com",
      role: "super_admin",
      siteId: null,
      tokenVersion: 1,
    };

    const peerBefore = db.select().from(users).where(eq(users.id, "admin-a2")).get();

    const passwordReset = await updateUserService(siteAdmin, "admin-a2", {
      password: "AnotherStrongPassword123",
    });
    expect(passwordReset.success).toBe(false);

    const peerDemotion = await updateUserService(siteAdmin, "admin-a2", { role: "author" });
    expect(peerDemotion.success).toBe(false);

    const peerDeletion = deleteUserService(siteAdmin, "admin-a2");
    expect(peerDeletion.success).toBe(false);

    const peerAfter = db.select().from(users).where(eq(users.id, "admin-a2")).get();
    expect(peerAfter?.passwordHash).toBe(peerBefore?.passwordHash);
    expect(peerAfter?.tokenVersion).toBe(peerBefore?.tokenVersion);
    expect(peerAfter?.role).toBe("admin");

    const selfDemotion = await updateUserService(siteAdmin, "admin-a", { role: "author" });
    expect(selfDemotion.success).toBe(false);

    // super_admin may reorganize admins, but never leaves a site without one.
    const promoted = await updateUserService(superAdmin, "admin-a2", { role: "editor" });
    expect(promoted.success).toBe(true);

    const lastAdminDemotion = await updateUserService(superAdmin, "admin-a", { role: "author" });
    expect(lastAdminDemotion.success).toBe(false);

    const lastAdminDeletion = deleteUserService(superAdmin, "admin-a");
    expect(lastAdminDeletion.success).toBe(false);
  });

  it("encrypts sensitive settings, redacts secrets on read, and preserves saved secrets on blank updates", async () => {
    const db = seedBaseTenants();
    process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-aaa";
    process.env.ENCRYPTION_KEY = "test-encryption-key-must-differ-32-chars-bbb";

    const adminActor: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };

    const badKey = await saveSiteSettingsService(adminActor, "site-a", {
      unsupported_arbitrary_key: "value",
    });
    expect(badKey.success).toBe(false);

    const customAiDenied = await saveSiteSettingsService(adminActor, "site-a", {
      ai_api_url: "https://evil-proxy.example.com/v1",
    });
    expect(customAiDenied.success).toBe(false);
    if (!customAiDenied.success) {
      expect(customAiDenied.error).toContain("super administrator");
    }

    const saved = await saveSiteSettingsService(adminActor, "site-a", {
      ai_api_key: "sk-secret-token-value-123456",
      ai_enabled: "true",
    });
    expect(saved.success).toBe(true);

    // Blank submission preserves stored ciphertext
    const preserved = await saveSiteSettingsService(adminActor, "site-a", {
      ai_api_key: "",
      ai_model: "gpt-4o-mini",
    });
    expect(preserved.success).toBe(true);

    const rawRow = db
      .select()
      .from(settings)
      .where(eq(settings.key, "ai_api_key"))
      .get();
    expect(rawRow?.value.startsWith("v2:")).toBe(true);

    const redacted = getRedactedSiteSettings("site-a");
    expect(redacted.ai_api_key).toBeUndefined();
    expect(redacted.has_ai_api_key).toBe("true");
    expect(redacted.ai_api_key_masked).toBe("sk-s...3456");

    clearSiteSecretSettingService(adminActor, "site-a", "ai_api_key");
    expect(getRedactedSiteSettings("site-a").has_ai_api_key).toBeUndefined();
  });

  it("deletes analytics strictly by postId without touching overlapping slugs and isolates audit logs by tenant", async () => {
    const db = seedBaseTenants();

    const adminA: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const superAdmin: TokenPayload = {
      userId: "super-1",
      email: "super@test.com",
      role: "super_admin",
      siteId: null,
      tokenVersion: 1,
    };

    const p1 = await createPostService(adminA, "site-a", {
      title: "Post",
      slug: "post",
      excerpt: "",
      contentMd: "<p>One</p>",
      contentHtml: "<p>One</p>",
      status: "published",
      locale: "en",
      pinned: false,
      categoryIds: [],
      tagIds: [],
    });
    const p2 = await createPostService(adminA, "site-a", {
      title: "Post 2",
      slug: "post-2",
      excerpt: "",
      contentMd: "<p>Two</p>",
      contentHtml: "<p>Two</p>",
      status: "published",
      locale: "en",
      pinned: false,
      categoryIds: [],
      tagIds: [],
    });
    const p3 = await createPostService(adminA, "site-a", {
      title: "My Post",
      slug: "my-post",
      excerpt: "",
      contentMd: "<p>Three</p>",
      contentHtml: "<p>Three</p>",
      status: "published",
      locale: "en",
      pinned: false,
      categoryIds: [],
      tagIds: [],
    });

    const id1 = p1.result.success ? p1.result.postId : "";
    const id2 = p2.result.success ? p2.result.postId : "";
    const id3 = p3.result.success ? p3.result.postId : "";

    db.insert(analytics)
      .values([
        { siteId: "site-a", postId: id1, path: "/entry/post", ipHash: "h1" },
        { siteId: "site-a", postId: id2, path: "/entry/post-2", ipHash: "h2" },
        { siteId: "site-a", postId: id3, path: "/entry/my-post", ipHash: "h3" },
      ])
      .run();

    await deletePostService(adminA, id1);
    const remainingAnalytics = db.select().from(analytics).all();
    expect(remainingAnalytics.map((a) => a.postId).sort()).toEqual([id2, id3].sort());

    recordAuditEvent({
      actorId: "super-1",
      actorEmail: "super@test.com",
      actorRole: "super_admin",
      siteId: "site-b",
      action: "site.domain_change",
      targetType: "site",
      targetId: "site-b",
    });

    const siteALogs = listAuditLogsForActor(adminA, "site-b");
    expect(siteALogs.every((l) => l.siteId === "site-a")).toBe(true);
    expect(siteALogs.some((l) => l.action === "post.delete")).toBe(true);

    const siteBLogs = listAuditLogsForActor(superAdmin, "site-b");
    expect(siteBLogs).toHaveLength(1);
    expect(siteBLogs[0].action).toBe("site.domain_change");

    const globalLogs = listAuditLogsForActor(superAdmin, null);
    expect(globalLogs.some((l) => l.siteId === "site-a")).toBe(true);
    expect(globalLogs.some((l) => l.siteId === "site-b")).toBe(true);
  });

  it("keeps posts and pages when their author is deleted and reassigns them to the actor", () => {
    const db = seedBaseTenants();
    const now = new Date();
    db.insert(posts)
      .values({
        id: "post-kept",
        siteId: "site-a",
        authorId: "author-a1",
        title: "Kept",
        slug: "kept",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(pages)
      .values({
        id: "page-kept",
        siteId: "site-a",
        authorId: "author-a1",
        title: "Kept page",
        slug: "kept-page",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const postsSql = db.$client
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'posts'")
      .get() as { sql: string };
    const pagesSql = db.$client
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pages'")
      .get() as { sql: string };
    expect(postsSql.sql).toMatch(/author_id[^,]*ON DELETE RESTRICT/i);
    expect(pagesSql.sql).toMatch(/author_id[^,]*ON DELETE RESTRICT/i);

    const admin: TokenPayload = {
      userId: "admin-a",
      email: "admin-a@test.com",
      role: "admin",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const deleted = deleteUserService(admin, "author-a1");
    expect(deleted.success).toBe(true);
    expect(db.select().from(users).where(eq(users.id, "author-a1")).get()).toBeUndefined();
    expect(db.select().from(posts).where(eq(posts.id, "post-kept")).get()?.authorId).toBe("admin-a");
    expect(db.select().from(pages).where(eq(pages.id, "page-kept")).get()?.authorId).toBe("admin-a");
  });

  it("lets an author delete only their own content and lets an editor delete another author's post", async () => {
    const db = seedBaseTenants();
    const now = new Date();
    db.insert(users)
      .values({
        id: "editor-a",
        email: "editor-a@test.com",
        passwordHash: "hash",
        displayName: "Editor",
        role: "editor",
        siteId: "site-a",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();
    db.insert(posts)
      .values([
        {
          id: "own-post",
          siteId: "site-a",
          authorId: "author-a1",
          title: "Own",
          slug: "own",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "other-post",
          siteId: "site-a",
          authorId: "admin-a",
          title: "Other",
          slug: "other",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();
    db.insert(pages)
      .values([
        {
          id: "own-page",
          siteId: "site-a",
          authorId: "author-a1",
          title: "Own page",
          slug: "own-page",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "other-page",
          siteId: "site-a",
          authorId: "admin-a",
          title: "Other page",
          slug: "other-page",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    const author: TokenPayload = {
      userId: "author-a1",
      email: "author1@test.com",
      role: "author",
      siteId: "site-a",
      tokenVersion: 1,
    };
    const editor: TokenPayload = {
      userId: "editor-a",
      email: "editor-a@test.com",
      role: "editor",
      siteId: "site-a",
      tokenVersion: 1,
    };

    const deniedPost = await deletePostService(author, "other-post");
    expect(deniedPost.success).toBe(false);
    expect(db.select().from(posts).where(eq(posts.id, "other-post")).get()).toBeTruthy();

    const ownPost = await deletePostService(author, "own-post");
    expect(ownPost.success).toBe(true);
    expect(db.select().from(posts).where(eq(posts.id, "own-post")).get()).toBeUndefined();

    const deniedPage = deletePageService(author, "other-page");
    expect(deniedPage.success).toBe(false);
    expect(db.select().from(pages).where(eq(pages.id, "other-page")).get()).toBeTruthy();

    const ownPage = deletePageService(author, "own-page");
    expect(ownPage.success).toBe(true);
    expect(db.select().from(pages).where(eq(pages.id, "own-page")).get()).toBeUndefined();

    const editorDelete = await deletePostService(editor, "other-post");
    expect(editorDelete.success).toBe(true);
    expect(db.select().from(posts).where(eq(posts.id, "other-post")).get()).toBeUndefined();
  });
});
