import { afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { posts, settings, sites, users } from "@/lib/db/schema";

const mockState = vi.hoisted(() => ({
  host: "seo-a.test",
  cacheStore: new Map<string, unknown>(),
  tagKeys: new Map<string, Set<string>>(),
  dbLoaderCalls: 0,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mockState.host }),
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(
    fn: T,
    keyParts: string[],
    options?: { tags?: string[] }
  ) => {
    const cacheKey = JSON.stringify(keyParts);
    for (const tag of options?.tags || []) {
      if (!mockState.tagKeys.has(tag)) mockState.tagKeys.set(tag, new Set());
      mockState.tagKeys.get(tag)!.add(cacheKey);
    }
    return async (...args: Parameters<T>) => {
      const fullKey = `${cacheKey}:${JSON.stringify(args)}`;
      for (const tag of options?.tags || []) {
        mockState.tagKeys.get(tag)!.add(fullKey);
      }
      if (mockState.cacheStore.has(fullKey)) {
        return mockState.cacheStore.get(fullKey);
      }
      mockState.dbLoaderCalls += 1;
      const value = await fn(...args);
      mockState.cacheStore.set(fullKey, value);
      return value;
    };
  },
  revalidateTag: (tag: string) => {
    const keys = mockState.tagKeys.get(tag);
    if (!keys) return;
    for (const key of keys) {
      mockState.cacheStore.delete(key);
    }
    keys.clear();
  },
  revalidatePath: vi.fn(),
}));

import robots from "@/app/robots";
import {
  getCachedLlmsFullPosts,
  getCachedLlmsSummaryData,
  getCachedSiteSeoSettings,
} from "@/lib/queries/seo";
import { revalidateSiteShell } from "@/lib/cache/revalidate";

describe("Tenant SEO settings, robots.txt, and LLMs cache isolation", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    mockState.cacheStore.clear();
    mockState.tagKeys.clear();
    mockState.dbLoaderCalls = 0;
    ctx?.cleanup();
    ctx = null;
  });

  it("isolates cached robots.txt rules, SEO flags, and LLMs data per tenant and invalidates via revalidateSiteShell", async () => {
    ctx = createTempDb("kotonoba-seo-cache-int");
    const { db } = ctx;
    const now = new Date();

    db.insert(sites)
      .values([
        { id: "site-a", domain: "seo-a.test", name: "SEO A", locale: "en", createdAt: now, updatedAt: now },
        { id: "site-b", domain: "seo-b.test", name: "SEO B", locale: "en", createdAt: now, updatedAt: now },
      ])
      .run();

    db.insert(users)
      .values({
        id: "u1",
        email: "seo@test.local",
        passwordHash: "hash",
        displayName: "Author",
        role: "admin",
        siteId: "site-a",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.insert(settings)
      .values([
        { siteId: "site-a", key: "block_ai_crawlers", value: "true" },
        { siteId: "site-a", key: "llms_txt_enabled", value: "false" },
        { siteId: "site-b", key: "block_ai_crawlers", value: "false" },
        { siteId: "site-b", key: "llms_txt_enabled", value: "true" },
        { siteId: "site-b", key: "llms_txt_custom", value: "Tenant B guidance" },
      ])
      .run();

    db.insert(posts)
      .values([
        {
          id: "post-a",
          siteId: "site-a",
          authorId: "u1",
          title: "Post A",
          slug: "post-a",
          locale: "en",
          content: "<p>Body A</p>",
          contentHtml: "<p>Body A</p>",
          contentMd: "",
          contentFormat: "html",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "post-b",
          siteId: "site-b",
          authorId: "u1",
          title: "Post B",
          slug: "post-b",
          locale: "en",
          content: "# Body B",
          contentHtml: "",
          contentMd: "# Body B",
          contentFormat: "markdown",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    // Site A blocks AI crawlers in robots.txt
    mockState.host = "seo-a.test";
    const robotsA = await robots();
    const rulesA = Array.isArray(robotsA.rules) ? robotsA.rules : [robotsA.rules];
    expect(robotsA.sitemap).toBe("https://seo-a.test/sitemap.xml");
    expect(rulesA.some((rule) => rule.userAgent === "GPTBot")).toBe(true);

    // Site B allows AI crawlers despite identical cached loader path
    mockState.host = "seo-b.test";
    const robotsB = await robots();
    const rulesB = Array.isArray(robotsB.rules) ? robotsB.rules : [robotsB.rules];
    expect(robotsB.sitemap).toBe("https://seo-b.test/sitemap.xml");
    expect(rulesB.some((rule) => rule.userAgent === "GPTBot")).toBe(false);

    // Warm cache serves site-b SEO settings without re-hitting DB; revalidateSiteShell refreshes only site-b
    const warmSeo = await getCachedSiteSeoSettings("site-b", "seo-b.test");
    expect(warmSeo).toEqual({
      blockAiCrawlers: false,
      llmsTxtEnabled: true,
      llmsTxtCustom: "Tenant B guidance",
    });

    const callsBeforeHit = mockState.dbLoaderCalls;
    await getCachedSiteSeoSettings("site-b", "seo-b.test");
    expect(mockState.dbLoaderCalls).toBe(callsBeforeHit);

    db.update(settings)
      .set({ value: "true" })
      .where(and(eq(settings.siteId, "site-b"), eq(settings.key, "block_ai_crawlers")))
      .run();

    expect((await getCachedSiteSeoSettings("site-b", "seo-b.test")).blockAiCrawlers).toBe(false);
    revalidateSiteShell("site-b");
    expect((await getCachedSiteSeoSettings("site-b", "seo-b.test")).blockAiCrawlers).toBe(true);

    // LLMs cached data remains strictly scoped per tenant
    const llmsB = await getCachedLlmsSummaryData("site-b", "seo-b.test");
    expect(llmsB.topPosts.map((p) => p.slug)).toEqual(["post-b"]);
    const fullB = await getCachedLlmsFullPosts("site-b", "seo-b.test");
    expect(fullB.map((p) => p.content)).toEqual(["# Body B"]);
  });
});
