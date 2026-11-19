import { describe, it, expect, afterEach } from "vitest";
import { parseDeviceAndBrowser } from "@/lib/utils/analytics";
import { getDateRangeBounds } from "@/lib/analytics/query";
import {
  aggregateDailyAnalytics,
  getDailyAnalyticsSummary,
  getSiteRetentionSummary,
  pruneExpiredAnalytics,
} from "@/lib/analytics/retention";
import { sites, analytics } from "@/lib/db/schema";
import { createTempDb, type TempDbContext } from "../helpers/db";

describe("analytics helpers and retention", () => {
  let ctx: TempDbContext | null = null;

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("classifies device, browser, and OS from user agent strings", () => {
    const mobile = parseDeviceAndBrowser(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(mobile.device).toBe("mobile");
    expect(mobile.os).toBe("iOS");
    expect(mobile.browser).toBe("Safari");

    const desktop = parseDeviceAndBrowser(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
    );
    expect(desktop.device).toBe("desktop");
    expect(desktop.os).toBe("Windows");
    expect(desktop.browser).toBe("Edge");
  });

  it("computes date range bounds accurately", () => {
    const bounds = getDateRangeBounds("7d");
    expect(bounds.days).toBe(7);
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("calculates visitor retention cohorts across multi-day visits", () => {
    ctx = createTempDb();
    const { db } = ctx;
    const now = new Date("2026-11-18T12:00:00Z");

    db.insert(sites)
      .values({
        id: "site-1",
        domain: "blog.example.com",
        name: "Blog",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const dayMs = 24 * 60 * 60 * 1000;
    db.insert(analytics)
      .values([
        {
          siteId: "site-1",
          path: "/",
          ipHash: "returning-user",
          createdAt: new Date(now.getTime() - 10 * dayMs),
        },
        {
          siteId: "site-1",
          path: "/entry/hello",
          ipHash: "returning-user",
          createdAt: new Date(now.getTime() - 2 * dayMs),
        },
        {
          siteId: "site-1",
          path: "/",
          ipHash: "one-time-user",
          createdAt: new Date(now.getTime() - 1 * dayMs),
        },
      ])
      .run();

    const summary = getSiteRetentionSummary("site-1", now.getTime());
    expect(summary.totalVisitors).toBe(2);
    expect(summary.returningVisitors).toBe(1);
    expect(summary.newVisitors).toBe(1);
    expect(summary.retentionRate).toBe(50);
    expect(summary.cohorts).toHaveLength(4);
  });

  it("prunes analytics events older than the retention window while keeping recent rows", () => {
    ctx = createTempDb();
    const { db } = ctx;
    const now = new Date("2026-11-18T12:00:00Z");
    const dayMs = 24 * 60 * 60 * 1000;

    db.insert(sites)
      .values({
        id: "site-ret",
        domain: "ret.example.com",
        name: "Retention Blog",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(analytics)
      .values([
        {
          siteId: "site-ret",
          path: "/old",
          ipHash: "old-visitor",
          createdAt: new Date(now.getTime() - 400 * dayMs),
        },
        {
          siteId: "site-ret",
          path: "/fresh",
          ipHash: "fresh-visitor",
          createdAt: new Date(now.getTime() - 10 * dayMs),
        },
      ])
      .run();

    expect(pruneExpiredAnalytics(0, now.getTime())).toBe(0);
    const deletedCount = pruneExpiredAnalytics(365, now.getTime());
    expect(deletedCount).toBe(1);

    const remaining = db.select().from(analytics).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].path).toBe("/fresh");

    // Pre-aggregated daily rollup must retain historical counts for pruned rows
    const daily = getDailyAnalyticsSummary("site-ret");
    expect(daily.length).toBeGreaterThanOrEqual(1);
    expect(daily.some((row) => row.path === "/old" && row.views === 1 && row.uniqueVisitors === 1)).toBe(true);

    // Calling aggregateDailyAnalytics again must remain idempotent
    aggregateDailyAnalytics({ siteId: "site-ret" });
    const dailyAfter = getDailyAnalyticsSummary("site-ret");
    expect(dailyAfter.find((row) => row.path === "/old")?.views).toBe(1);
  });
});
