import dns from "dns/promises";
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTempDb, type TempDbContext } from "../helpers/db";
import { sites, users, posts, analytics, settings, notificationOutbox } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/crypto";
import { eq } from "drizzle-orm";

const mockState = vi.hoisted(() => ({
  host: "llms.test",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mockState.host }),
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { POST as postCronPublish } from "@/app/api/cron/publish/route";
import { POST as postCronAnalytics } from "@/app/api/cron/analytics/route";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { GET as getLlmsFullTxt } from "@/app/llms-full.txt/route";

describe("Cron publish endpoint authorization, retention pruning & LLMs feeds", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockState.host = "llms.test";
    ctx?.cleanup();
    ctx = null;
  });

  it("enforces CRON_SECRET bearer auth, publishes due scheduled items, and prunes expired analytics", async () => {
    ctx = createTempDb("kotonoba-cron-endpoint");
    const { db } = ctx;
    const now = new Date();
    const past = new Date(now.getTime() - 120_000);
    const future = new Date(now.getTime() + 3_600_000);
    const staleDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

    db.insert(sites).values({ id: "s1", domain: "cron.test", name: "Cron", createdAt: now, updatedAt: now }).run();
    db.insert(users)
      .values({
        id: "u1",
        email: "admin@cron.test",
        passwordHash: "hash",
        displayName: "Admin",
        role: "super_admin",
        siteId: null,
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    db.insert(posts)
      .values([
        {
          id: "due-1",
          siteId: "s1",
          authorId: "u1",
          title: "Due Article",
          slug: "due-article",
          status: "scheduled",
          publishedAt: past,
          createdAt: past,
          updatedAt: past,
        },
        {
          id: "future-1",
          siteId: "s1",
          authorId: "u1",
          title: "Future Article",
          slug: "future-article",
          status: "scheduled",
          publishedAt: future,
          createdAt: past,
          updatedAt: past,
        },
      ])
      .run();

    db.insert(analytics)
      .values([
        {
          siteId: "s1",
          path: "/entry/due-article",
          ipHash: "hash-stale",
          createdAt: staleDate,
        },
        {
          siteId: "s1",
          path: "/entry/due-article",
          ipHash: "hash-fresh",
          createdAt: now,
        },
      ])
      .run();

    // Production without CRON_SECRET fails closed with 503
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    const noSecretRes = await postCronPublish(
      new NextRequest("http://cron.test/api/cron/publish", { method: "POST" })
    );
    expect(noSecretRes.status).toBe(503);

    // Wrong token fails with 401
    vi.stubEnv("CRON_SECRET", "super-secret-cron-token-123");
    const badRes = await postCronPublish(
      new NextRequest("http://cron.test/api/cron/publish", {
        method: "POST",
        headers: { authorization: "Bearer wrong-token" },
      })
    );
    expect(badRes.status).toBe(401);

    // Valid token transitions due scheduled posts only.
    vi.stubEnv("ANALYTICS_RETENTION_DAYS", "365");
    const okRes = await postCronPublish(
      new NextRequest("http://cron.test/api/cron/publish", {
        method: "POST",
        headers: { authorization: "Bearer super-secret-cron-token-123" },
      })
    );
    expect(okRes.status).toBe(200);
    const json = await okRes.json();
    expect(json.success).toBe(true);
    expect(json.publishedPostsCount).toBe(1);
    expect(json.prunedAnalyticsCount).toBeUndefined();

    // Analytics maintenance is a separate daily run.
    const analyticsRes = await postCronAnalytics(
      new NextRequest("http://cron.test/api/cron/analytics", {
        method: "POST",
        headers: { authorization: "Bearer super-secret-cron-token-123" },
      })
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsJson = await analyticsRes.json();
    expect(analyticsJson.aggregatedDailyCount).toBeGreaterThanOrEqual(1);
    expect(analyticsJson.prunedAnalyticsCount).toBe(1);

    expect(db.select().from(posts).where(eq(posts.id, "due-1")).get()?.status).toBe("published");
    expect(db.select().from(posts).where(eq(posts.id, "future-1")).get()?.status).toBe("scheduled");
    expect(db.select().from(analytics).where(eq(analytics.ipHash, "hash-stale")).get()).toBeUndefined();
    expect(db.select().from(analytics).where(eq(analytics.ipHash, "hash-fresh")).get()).toBeDefined();
  });

  it("dispatches encrypted Discord webhook notifications via outbox and prevents duplicate sends", async () => {
    ctx = createTempDb("kotonoba-cron-outbox");
    const { db } = ctx;
    const now = new Date();
    const past = new Date(now.getTime() - 120_000);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "super-secret-cron-token-123");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key-at-least-32-chars!!");

    db.insert(sites)
      .values({ id: "s1", domain: "cron.test", name: "Cron Blog", createdAt: now, updatedAt: now })
      .run();
    db.insert(users)
      .values({
        id: "u1",
        email: "admin@cron.test",
        passwordHash: "hash",
        displayName: "Admin",
        role: "super_admin",
        siteId: null,
        tokenVersion: 1,
        createdAt: now,
      })
      .run();
    db.insert(settings)
      .values([
        { siteId: "s1", key: "discord_notifications_enabled", value: "true" },
        {
          siteId: "s1",
          key: "discord_webhook_url",
          value: encryptSecret("https://discord.com/api/webhooks/123456789/secret-token"),
        },
      ])
      .run();
    db.insert(posts)
      .values({
        id: "due-notif-1",
        siteId: "s1",
        authorId: "u1",
        title: "Due Notification Article",
        slug: "due-notification-article",
        excerpt: "Published automatically by cron.",
        status: "scheduled",
        publishedAt: past,
        createdAt: past,
        updatedAt: past,
      })
      .run();

    vi.spyOn(dns, "lookup").mockImplementation(
      ((async () => [{ address: "162.159.135.232", family: 4 }]) as unknown) as typeof dns.lookup
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const firstRes = await postCronPublish(
      new NextRequest("http://cron.test/api/cron/publish", {
        method: "POST",
        headers: { authorization: "Bearer super-secret-cron-token-123" },
      })
    );
    expect(firstRes.status).toBe(200);
    const firstJson = await firstRes.json();
    expect(firstJson.publishedPostsCount).toBe(1);
    expect(firstJson.notificationsSent).toBe(1);
    expect(firstJson.notificationsFailed).toBe(0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [webhookTarget, requestInit] = fetchSpy.mock.calls[0];
    expect(String(webhookTarget)).toBe("https://discord.com/api/webhooks/123456789/secret-token");
    expect(requestInit?.method).toBe("POST");
    const parsedBody = JSON.parse(String(requestInit?.body)) as {
      embeds?: Array<{ title?: string; url?: string }>;
    };
    expect(parsedBody.embeds?.[0]?.title).toBe("Due Notification Article");
    expect(parsedBody.embeds?.[0]?.url).toContain("/entry/due-notification-article");

    const outboxRow = db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.postId, "due-notif-1"))
      .get();
    expect(outboxRow?.channel).toBe("discord");
    expect(outboxRow?.status).toBe("sent");
    expect(outboxRow?.attempts).toBe(1);

    const secondRes = await postCronPublish(
      new NextRequest("http://cron.test/api/cron/publish", {
        method: "POST",
        headers: { authorization: "Bearer super-secret-cron-token-123" },
      })
    );
    expect(secondRes.status).toBe(200);
    const secondJson = await secondRes.json();
    expect(secondJson.publishedPostsCount).toBe(0);
    expect(secondJson.notificationsSent).toBe(0);
    expect(secondJson.notificationsFailed).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("enforces opt-in and anti-AI gates on /llms.txt and /llms-full.txt with clean canonical body extraction", async () => {
    ctx = createTempDb("kotonoba-llms-int");
    const { db } = ctx;
    const now = new Date();
    mockState.host = "llms.test";

    db.insert(sites)
      .values({ id: "s1", domain: "llms.test", name: "LLMs Site", locale: "en", createdAt: now, updatedAt: now })
      .run();
    db.insert(users)
      .values({
        id: "u1",
        email: "author@llms.test",
        passwordHash: "hash",
        displayName: "Author",
        role: "admin",
        siteId: "s1",
        tokenVersion: 1,
        createdAt: now,
      })
      .run();
    db.insert(posts)
      .values([
        {
          id: "post-es",
          siteId: "s1",
          authorId: "u1",
          title: "Guía Técnica",
          slug: "guia-tecnica",
          locale: "es",
          contentHtml: "<p>Hola <strong>mundo</strong>.</p><script>alert(1)</script><p>Segunda línea.</p>",
          contentMd: "<p>Hola <strong>mundo</strong>.</p><script>alert(1)</script><p>Segunda línea.</p>",
          contentFormat: "html",
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    // Default disabled -> 404
    const req1 = new NextRequest("http://llms.test/llms.txt", { headers: { host: "llms.test" } });
    expect((await getLlmsTxt(req1)).status).toBe(404);
    expect((await getLlmsFullTxt(req1)).status).toBe(404);

    // Enable llms_txt_enabled -> 200 with localized URL and sanitized readable plain text
    db.insert(settings).values({ siteId: "s1", key: "llms_txt_enabled", value: "true" }).run();
    const resIndex = await getLlmsTxt(req1);
    expect(resIndex.status).toBe(200);
    const indexText = await resIndex.text();
    expect(indexText).toContain("https://llms.test/es/entry/guia-tecnica");

    const reqFull = new NextRequest("http://llms.test/llms-full.txt", { headers: { host: "llms.test" } });
    const resFull = await getLlmsFullTxt(reqFull);
    expect(resFull.status).toBe(200);
    const fullText = await resFull.text();
    expect(fullText).toContain("Hola mundo.");
    expect(fullText).toContain("Segunda línea.");
    expect(fullText).not.toContain("<script>");
    expect(fullText).not.toContain("<strong>");

    // Blocking AI crawlers overrides llms_txt_enabled -> 404
    db.insert(settings).values({ siteId: "s1", key: "block_ai_crawlers", value: "true" }).run();
    expect((await getLlmsTxt(req1)).status).toBe(404);
    expect((await getLlmsFullTxt(reqFull)).status).toBe(404);
  });
});
