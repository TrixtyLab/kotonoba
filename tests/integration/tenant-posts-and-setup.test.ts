import { describe, it, expect, afterEach } from "vitest";
import { createTempDb, type TempDbContext } from "../helpers/db";
import {
  sites,
  users,
  posts,
  categories,
  tags,
  postCategories,
  postTags,
  analytics,
  settings,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getPaginatedPublicPosts,
  searchPublicPosts,
} from "@/lib/queries/public-posts";
import { completeSetupWizard } from "@/actions/setup";
import { hashPassword } from "@/lib/auth/password";

describe("Tenant constraints, cascade deletion, queries & setup locking", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("enforces tenant-scoped unique slugs and cascades site deletion cleanly", async () => {
    ctx = createTempDb("kotonoba-tenant-int");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values({ id: "site-1", domain: "one.test", name: "One", createdAt: now, updatedAt: now })
      .run();
    db.insert(sites)
      .values({ id: "site-2", domain: "two.test", name: "Two", createdAt: now, updatedAt: now })
      .run();

    const pwHash = await hashPassword("StrongPass123");
    db.insert(users)
      .values([
        {
          id: "user-1",
          email: "author@one.test",
          passwordHash: pwHash,
          displayName: "Author",
          role: "admin",
          siteId: "site-1",
          tokenVersion: 1,
          createdAt: now,
        },
        {
          id: "user-2",
          email: "author@two.test",
          passwordHash: pwHash,
          displayName: "Author Two",
          role: "admin",
          siteId: "site-2",
          tokenVersion: 1,
          createdAt: now,
        },
      ])
      .run();

    db.insert(posts)
      .values({
        id: "p-1",
        siteId: "site-1",
        authorId: "user-1",
        title: "Hello",
        slug: "hello",
        status: "published",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Duplicate slug within same site must fail due to unique index
    expect(() =>
      db
        .insert(posts)
        .values({
          id: "p-dup",
          siteId: "site-1",
          authorId: "user-1",
          title: "Hello Again",
          slug: "hello",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    ).toThrow();

    // Same slug on another site succeeds cleanly
    expect(() =>
      db
        .insert(posts)
        .values({
          id: "p-2",
          siteId: "site-2",
          authorId: "user-2",
          title: "Hello Site Two",
          slug: "hello",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run()
    ).not.toThrow();

    db.insert(categories).values({ id: "cat-1", siteId: "site-1", name: "Tech", slug: "tech" }).run();
    db.insert(postCategories).values({ postId: "p-1", categoryId: "cat-1" }).run();
    db.insert(settings).values({ siteId: "site-1", key: "ai_enabled", value: "false" }).run();
    db.insert(analytics).values({ siteId: "site-1", postId: "p-1", path: "/entry/hello", ipHash: "h1" }).run();

    // Cascade delete of site-1 removes dependent records while keeping site-2 intact
    db.delete(sites).where(eq(sites.id, "site-1")).run();

    expect(db.select().from(posts).where(eq(posts.siteId, "site-1")).all()).toHaveLength(0);
    expect(db.select().from(categories).where(eq(categories.siteId, "site-1")).all()).toHaveLength(0);
    expect(db.select().from(settings).where(eq(settings.siteId, "site-1")).all()).toHaveLength(0);
    expect(db.select().from(analytics).where(eq(analytics.siteId, "site-1")).all()).toHaveLength(0);
    expect(db.select().from(posts).where(eq(posts.id, "p-2")).all()).toHaveLength(1);
  });

  it("paginates public posts with batched taxonomies and tenant-isolated search", async () => {
    ctx = createTempDb("kotonoba-pagination-int");
    const { db } = ctx;
    const now = Date.now();

    db.insert(sites)
      .values({ id: "s1", domain: "s1.test", name: "S1", createdAt: new Date(), updatedAt: new Date() })
      .run();
    db.insert(sites)
      .values({ id: "s2", domain: "s2.test", name: "S2", createdAt: new Date(), updatedAt: new Date() })
      .run();

    db.insert(users)
      .values({
        id: "u1",
        email: "u1@s1.test",
        passwordHash: "hash",
        displayName: "Writer",
        role: "admin",
        siteId: "s1",
        tokenVersion: 1,
        createdAt: new Date(),
      })
      .run();

    db.insert(categories).values({ id: "c1", siteId: "s1", name: "News", slug: "news" }).run();
    db.insert(tags).values({ id: "t1", siteId: "s1", name: "Release", slug: "release" }).run();

    for (let i = 1; i <= 7; i++) {
      const ts = new Date(now - (10 - i) * 60_000);
      db.insert(posts)
        .values({
          id: `post-${i}`,
          siteId: "s1",
          authorId: "u1",
          title: `Article ${i} Roadmap`,
          slug: `article-${i}`,
          status: "published",
          publishedAt: ts,
          createdAt: ts,
          updatedAt: ts,
        })
        .run();
      if (i % 2 === 1) {
        db.insert(postCategories).values({ postId: `post-${i}`, categoryId: "c1" }).run();
        db.insert(postTags).values({ postId: `post-${i}`, tagId: "t1" }).run();
      }
    }

    db.insert(posts)
      .values({
        id: "s2-secret",
        siteId: "s2",
        authorId: "u1",
        title: "Secret Roadmap Site Two",
        slug: "secret-s2",
        status: "published",
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const page1 = getPaginatedPublicPosts({ siteId: "s1", page: 1, pageSize: 5 });
    expect(page1.totalCount).toBe(7);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(5);
    expect(page1.items[0].id).toBe("post-7");
    expect(page1.items[0].categories.map((c) => c.slug)).toEqual(["news"]);
    expect(page1.items[0].tags.map((t) => t.slug)).toEqual(["release"]);

    const page2 = getPaginatedPublicPosts({ siteId: "s1", page: 2, pageSize: 5 });
    expect(page2.currentPage).toBe(2);
    expect(page2.items).toHaveLength(2);

    const catFiltered = getPaginatedPublicPosts({ siteId: "s1", categoryId: "c1", page: 1, pageSize: 10 });
    expect(catFiltered.totalCount).toBe(4);

    const results = searchPublicPosts("s1", "Roadmap");
    expect(results.every((r) => r.id !== "s2-secret")).toBe(true);
    expect(results).toHaveLength(7);
  });

  it("enforces strong password policy in setup wizard", async () => {
    ctx = createTempDb("kotonoba-setup-int");

    const weakResult = await completeSetupWizard({
      adminName: "Admin",
      adminEmail: "admin@test.com",
      adminPassword: "weak",
      siteName: "Test Blog",
      siteSubtitle: "Sub",
      domain: "test.local",
      locale: "en",
      theme: "dark",
      primaryColor: "#6366f1",
      fontFamily: "Inter",
      categoryName: "General",
    });

    expect(weakResult.success).toBe(false);
    const countUsers = ctx.db.select({ c: sql<number>`count(*)` }).from(users).get();
    expect(countUsers?.c).toBe(0);
  });
});
