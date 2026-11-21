import { describe, it, expect, afterEach, vi } from "vitest";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, pages, categories, settings } from "@/lib/db/schema";

const cacheState = vi.hoisted(() => ({
  store: new Map<string, { value: unknown; tags: string[] }>(),
  recordedKeys: [] as string[][],
  host: "alpha.test",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: cacheState.host }),
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    keyParts: string[],
    options: { tags: string[]; revalidate?: number }
  ) => {
    const serializedKey = JSON.stringify(keyParts);
    cacheState.recordedKeys.push(keyParts);
    return async (...args: unknown[]) => {
      const existing = cacheState.store.get(serializedKey);
      if (existing) {
        return JSON.parse(JSON.stringify(existing.value));
      }
      const value = await fn(...args);
      cacheState.store.set(serializedKey, { value: JSON.parse(JSON.stringify(value)), tags: options.tags });
      return JSON.parse(JSON.stringify(value));
    };
  },
  revalidatePath: vi.fn(),
  revalidateTag: (tag: string) => {
    for (const [key, entry] of cacheState.store.entries()) {
      if (entry.tags.includes(tag)) {
        cacheState.store.delete(key);
      }
    }
  },
}));

import { getCachedPaginatedPublicPosts } from "@/lib/queries/public-posts";
import { getCachedPublicPostBySlug } from "@/lib/queries/public-post-detail";
import { getCachedPublicPageBySlug } from "@/lib/queries/pages";
import { getCachedSiteCategories } from "@/lib/queries/taxonomy";
import { getCachedSidebarBanners } from "@/lib/banners";
import { getPublicSite } from "@/lib/tenant";
import { revalidatePostPaths, sitePostsCacheTag } from "@/lib/cache/revalidate";
import { eq } from "drizzle-orm";

describe("Multi-tenant unstable_cache isolation across (siteId, locale, host) keys & tag invalidation", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    cacheState.store.clear();
    cacheState.recordedKeys.length = 0;
    cacheState.host = "alpha.test";
    ctx?.cleanup();
    ctx = null;
  });

  function seedTwoSites(db: TempDbContext["db"]) {
    const now = new Date();
    db.insert(sites)
      .values([
        { id: "site-a", domain: "alpha.test", name: "Alpha Site", locale: "en", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "beta.test", name: "Beta Site", locale: "es", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(users)
      .values({
        id: "u1",
        email: "author@test.dev",
        passwordHash: "hash",
        displayName: "Writer",
        role: "admin",
        siteId: null,
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.insert(categories)
      .values([
        { id: "cat-a", siteId: "site-a", name: "Alpha Cat", slug: "shared-cat" },
        { id: "cat-b", siteId: "site-b", name: "Beta Cat", slug: "shared-cat" },
      ])
      .run();

    db.insert(posts)
      .values([
        {
          id: "post-a",
          siteId: "site-a",
          authorId: "u1",
          title: "Alpha Hello",
          slug: "shared-slug",
          contentHtml: "<p>Alpha secret</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          locale: "en",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "post-b",
          siteId: "site-b",
          authorId: "u1",
          title: "Beta Hola",
          slug: "shared-slug",
          contentHtml: "<p>Beta secret</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          locale: "es",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    db.insert(pages)
      .values([
        {
          id: "page-a",
          siteId: "site-a",
          authorId: "u1",
          title: "Alpha About",
          slug: "about",
          contentHtml: "<p>About Alpha</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          locale: "en",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "page-b",
          siteId: "site-b",
          authorId: "u1",
          title: "Beta Acerca",
          slug: "about",
          contentHtml: "<p>About Beta</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          locale: "es",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    db.insert(settings)
      .values([
        {
          siteId: "site-a",
          key: "sidebar_banners",
          value: JSON.stringify([{ id: "b1", imageUrl: "/api/uploads/sites/site-a/a.png" }]),
        },
        {
          siteId: "site-b",
          key: "sidebar_banners",
          value: JSON.stringify([{ id: "b2", imageUrl: "/api/uploads/sites/site-b/b.png" }]),
        },
      ])
      .run();
  }

  it("isolates cached posts, pages, categories, banners, and host resolution per (siteId, locale, host) and surgically invalidates by tag", async () => {
    ctx = createTempDb("kotonoba-cache-iso");
    seedTwoSites(ctx.db);

    cacheState.host = "alpha.test";
    const resolvedA = await getPublicSite();
    cacheState.host = "beta.test";
    const resolvedB = await getPublicSite();

    expect(resolvedA?.id).toBe("site-a");
    expect(resolvedB?.id).toBe("site-b");

    // Populate Site A & Site B caches with identical slug/page slugs
    const [postA, postB, pageA, pageB, catsA, catsB, bannersA, bannersB] = await Promise.all([
      getCachedPublicPostBySlug("site-a", "shared-slug", "en", "alpha.test"),
      getCachedPublicPostBySlug("site-b", "shared-slug", "es", "beta.test"),
      getCachedPublicPageBySlug("site-a", "about", "en", "alpha.test"),
      getCachedPublicPageBySlug("site-b", "about", "es", "beta.test"),
      getCachedSiteCategories("site-a", "en", "alpha.test"),
      getCachedSiteCategories("site-b", "es", "beta.test"),
      getCachedSidebarBanners("site-a", "alpha.test"),
      getCachedSidebarBanners("site-b", "beta.test"),
    ]);

    expect(postA?.post.title).toBe("Alpha Hello");
    expect(postB?.post.title).toBe("Beta Hola");
    expect(pageA?.title).toBe("Alpha About");
    expect(pageB?.title).toBe("Beta Acerca");
    expect(catsA.map((c) => c.name)).toEqual(["Alpha Cat"]);
    expect(catsB.map((c) => c.name)).toEqual(["Beta Cat"]);
    expect(bannersA[0]?.imageUrl).toContain("/sites/site-a/");
    expect(bannersB[0]?.imageUrl).toContain("/sites/site-b/");

    // Distinct locale/host keys produce distinct cache key entries
    await getCachedPaginatedPublicPosts({ siteId: "site-a", locale: "en", host: "alpha.test" });
    await getCachedPaginatedPublicPosts({ siteId: "site-a", locale: "es", host: "mirror.test" });
    const postListKeys = cacheState.recordedKeys.filter((k) => k[0] === "public-posts");
    expect(postListKeys[0]).toContain("site-a");
    expect(postListKeys[0]).toContain("alpha.test");
    expect(postListKeys[0]).toContain("en");
    expect(postListKeys[1]).toContain("mirror.test");
    expect(postListKeys[1]).toContain("es");

    // Mutate DB rows on BOTH sites, then invalidate ONLY Site A's cache tag
    ctx.db.update(posts).set({ title: "Alpha Updated" }).where(eq(posts.id, "post-a")).run();
    ctx.db.update(posts).set({ title: "Beta Updated But Cached" }).where(eq(posts.id, "post-b")).run();

    expect(cacheState.store.size).toBeGreaterThan(0);
    revalidatePostPaths("shared-slug", null, "site-a");

    // Site A reads fresh DB row; Site B retains cached value (its tag was NOT invalidated)
    const afterA = await getCachedPublicPostBySlug("site-a", "shared-slug", "en", "alpha.test");
    const afterB = await getCachedPublicPostBySlug("site-b", "shared-slug", "es", "beta.test");
    expect(afterA?.post.title).toBe("Alpha Updated");
    expect(afterB?.post.title).toBe("Beta Hola");
    expect(sitePostsCacheTag("site-a")).toBe("site:site-a:posts");
  });
});
