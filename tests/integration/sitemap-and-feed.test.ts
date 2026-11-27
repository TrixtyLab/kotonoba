import { describe, it, expect, afterEach, vi } from "vitest";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, pages, categories, tags, settings } from "@/lib/db/schema";

const mockRequestState = vi.hoisted(() => ({
  host: "blog.test",
  cookieSiteId: "",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mockRequestState.host }),
  cookies: async () => ({
    get: (name: string) =>
      name === "kotonoba_admin_site_id" && mockRequestState.cookieSiteId
        ? { value: mockRequestState.cookieSiteId }
        : undefined,
  }),
}));

import sitemap from "@/app/sitemap";
import { GET as getFeedXml } from "@/app/feed.xml/route";

describe("Sitemap hreflang parity, RSS feed sanitization & host isolation", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    vi.unstubAllEnvs();
    mockRequestState.host = "blog.test";
    mockRequestState.cookieSiteId = "";
    ctx?.cleanup();
    ctx = null;
  });

  function seedTenantFixtures(db: TempDbContext["db"]) {
    const now = new Date();
    const past = new Date(now.getTime() - 120_000);
    const future = new Date(now.getTime() + 3_600_000);

    db.insert(sites)
      .values([
        {
          id: "site-a",
          domain: "blog.test",
          name: "Site A ]]> Title",
          description: "Desc ]]> End",
          locale: "en",
          supportedLocales: JSON.stringify(["en", "es"]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "site-b",
          domain: "other.test",
          name: "Other Tenant",
          locale: "en",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    db.insert(users)
      .values({
        id: "user-a",
        email: "author@blog.test",
        passwordHash: "hash",
        displayName: "Author A",
        role: "admin",
        siteId: "site-a",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.insert(categories)
      .values({
        id: "cat-tech",
        siteId: "site-a",
        name: "Tech",
        slug: "tech",
      })
      .run();

    db.insert(tags)
      .values({
        id: "tag-sec",
        siteId: "site-a",
        name: "Security",
        slug: "security",
      })
      .run();

    db.insert(posts)
      .values([
        {
          id: "p-en",
          siteId: "site-a",
          authorId: "user-a",
          title: "Hello ]]> EN",
          slug: "hello-en",
          excerpt: "Excerpt EN",
          contentHtml:
            '<p>Safe</p><script>alert("xss")</script><a href="javascript:evil()">bad</a>',
          contentMd: '<p>Safe</p><script>alert("xss")</script>',
          contentFormat: "html",
          status: "published",
          locale: "en",
          publishedAt: past,
          createdAt: past,
          updatedAt: past,
        },
        {
          id: "p-es",
          siteId: "site-a",
          authorId: "user-a",
          title: "Hola ES",
          slug: "hola-es",
          excerpt: "Resumen ES",
          contentHtml: "<p>Contenido limpio</p>",
          contentMd: "<p>Contenido limpio</p>",
          contentFormat: "html",
          status: "published",
          locale: "es",
          publishedAt: past,
          createdAt: past,
          updatedAt: past,
        },
        {
          id: "p-draft",
          siteId: "site-a",
          authorId: "user-a",
          title: "Draft Hidden",
          slug: "hidden-draft",
          status: "draft",
          locale: "en",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "p-future",
          siteId: "site-a",
          authorId: "user-a",
          title: "Future Scheduled",
          slug: "future-post",
          status: "scheduled",
          locale: "es",
          publishedAt: future,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "p-other-site",
          siteId: "site-b",
          authorId: "user-a",
          title: "Other Tenant Post",
          slug: "tenant-b-secret",
          status: "published",
          locale: "en",
          publishedAt: past,
          createdAt: past,
          updatedAt: past,
        },
      ])
      .run();

    db.insert(pages)
      .values({
        id: "pg-es",
        siteId: "site-a",
        authorId: "user-a",
        title: "Acerca",
        slug: "acerca",
        status: "published",
        locale: "es",
        publishedAt: past,
        createdAt: past,
        updatedAt: past,
      })
      .run();
  }

  it("emits strictly monolingual hreflang alternates per article/page and omits drafts and scheduled items", async () => {
    ctx = createTempDb("kotonoba-sitemap-int");
    seedTenantFixtures(ctx.db);
    mockRequestState.host = "blog.test";

    const entries = await sitemap();

    const enEntry = entries.find((e) => e.url === "https://blog.test/entry/hello-en");
    const esEntry = entries.find((e) => e.url === "https://blog.test/es/entry/hola-es");
    const esPage = entries.find((e) => e.url === "https://blog.test/es/p/acerca");
    const catEntry = entries.find((e) => e.url === "https://blog.test/category/tech");
    const tagEntry = entries.find((e) => e.url === "https://blog.test/tag/security");
    const archiveEntry = entries.find((e) => e.url === "https://blog.test/archive");

    expect(enEntry?.alternates?.languages).toEqual({
      en: "https://blog.test/entry/hello-en",
    });
    expect(esEntry?.alternates?.languages).toEqual({
      es: "https://blog.test/es/entry/hola-es",
    });
    expect(esPage?.alternates?.languages).toEqual({
      es: "https://blog.test/es/p/acerca",
    });
    expect(catEntry?.alternates?.languages).toEqual({
      en: "https://blog.test/category/tech",
      es: "https://blog.test/es/category/tech",
    });
    expect(tagEntry?.alternates?.languages).toEqual({
      en: "https://blog.test/tag/security",
      es: "https://blog.test/es/tag/security",
    });
    expect(archiveEntry?.alternates?.languages).toEqual({
      en: "https://blog.test/archive",
      es: "https://blog.test/es/archive",
    });

    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes("hidden-draft"))).toBe(false);
    expect(urls.some((u) => u.includes("future-post"))).toBe(false);
    expect(urls.some((u) => u.includes("tenant-b-secret"))).toBe(false);
  });

  it("sanitizes RSS feed payloads, escapes CDATA terminators, enforces rss_enabled, and fails closed on unknown hosts", async () => {
    ctx = createTempDb("kotonoba-feed-int");
    seedTenantFixtures(ctx.db);
    mockRequestState.host = "blog.test";

    const res = await getFeedXml();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");

    const xml = await res.text();
    expect(xml).toContain("Site A ]]]]><![CDATA[> Title");
    expect(xml).toContain("Hello ]]]]><![CDATA[> EN");
    expect(xml).toContain("<link>https://blog.test/entry/hello-en</link>");
    expect(xml).not.toContain("<link>https://blog.test/en/entry/hello-en</link>");
    expect(xml).toContain("<link>https://blog.test/es/entry/hola-es</link>");
    expect(xml).toContain("<p>Safe</p>");
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("javascript:evil()");
    expect(xml).not.toContain("hidden-draft");
    expect(xml).not.toContain("future-post");
    expect(xml).not.toContain("tenant-b-secret");

    // Disabled RSS returns 404
    ctx.db.insert(settings).values({ siteId: "site-a", key: "rss_enabled", value: "false" }).run();
    const disabledRes = await getFeedXml();
    expect(disabledRes.status).toBe(404);

    // Unknown host fails closed in production even with admin workspace cookie set
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SINGLE_TENANT_FALLBACK", "false");
    mockRequestState.host = "unassigned-evil.test";
    mockRequestState.cookieSiteId = "site-a";
    const unknownHostRes = await getFeedXml();
    expect(unknownHostRes.status).toBe(404);
  });
});
