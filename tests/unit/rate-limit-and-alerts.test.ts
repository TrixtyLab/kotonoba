import dns from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryRateLimitStore,
  RATE_LIMITS,
  checkRateLimit,
  resetRateLimitStore,
  setRateLimitStore,
} from "@/lib/security/rate-limit";
import { notifyCriticalAlert } from "@/lib/observability/alerts";

describe("Bounded rate limit store & critical alert notifications", () => {
  const origAlertUrl = process.env.ALERT_WEBHOOK_URL;

  afterEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
    if (origAlertUrl !== undefined) {
      process.env.ALERT_WEBHOOK_URL = origAlertUrl;
    } else {
      delete process.env.ALERT_WEBHOOK_URL;
    }
  });

  it("evicts oldest keys when exceeding maxEntries and resets quotas after window expiry", () => {
    const store = new InMemoryRateLimitStore(100);
    const policy = { maxRequests: 2, windowMs: 1_000 };
    const t0 = 1_000_000;

    // Fill 105 distinct keys inside capacity=100 -> oldest keys evicted while recent remain tracked
    for (let i = 0; i < 105; i++) {
      expect(store.consume(`k-${i}`, policy, t0).allowed).toBe(true);
    }

    // Oldest keys (k-0) were evicted and reset cleanly; newest keys (k-104) remember prior hit
    const recentSecond = store.consume("k-104", policy, t0 + 10);
    expect(recentSecond.allowed).toBe(true);
    expect(recentSecond.remaining).toBe(0);

    const recentBlocked = store.consume("k-104", policy, t0 + 20);
    expect(recentBlocked.allowed).toBe(false);
    expect(recentBlocked.retryAfter).toBe(1);

    // After rolling window expires, quota resets
    const afterExpiry = store.consume("k-104", policy, t0 + 1_100);
    expect(afterExpiry.allowed).toBe(true);
    expect(afterExpiry.remaining).toBe(1);
  });

  it("allows swapping custom RateLimitStore and restoring default store cleanly", () => {
    const customConsume = vi.fn(() => ({ allowed: false, remaining: 0, retryAfter: 42 }));
    setRateLimitStore({ consume: customConsume });

    const blocked = checkRateLimit("custom-key", RATE_LIMITS.auth);
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfter: 42 });
    expect(customConsume).toHaveBeenCalledWith("custom-key", RATE_LIMITS.auth);

    resetRateLimitStore();
    const restored = checkRateLimit("fresh-key", RATE_LIMITS.auth);
    expect(restored.allowed).toBe(true);
  });

  it("blocks unsafe/SSRF alert webhook targets and coalesces repeated alerts within 60s", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    vi.spyOn(dns, "lookup").mockImplementation(((
      _hostname: string,
      options?: unknown
    ) => {
      if (typeof options === "object" && options !== null && "all" in options && options.all) {
        return Promise.resolve([{ address: "93.184.216.34", family: 4 }]);
      }
      return Promise.resolve({ address: "93.184.216.34", family: 4 });
    }) as typeof dns.lookup);

    // Reject loopback/SSRF targets without invoking fetch
    process.env.ALERT_WEBHOOK_URL = "http://127.0.0.1:8080/internal-hook";
    await notifyCriticalAlert("test.ssrf.loopback", { route: "/admin" });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Deliver valid HTTPS alert once and coalesce immediate repeat inside cooldown window
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/webhook";
    await notifyCriticalAlert("test.cooldown.event", { path: "/api/cron/publish", code: 500 });
    await notifyCriticalAlert("test.cooldown.event", { path: "/api/cron/publish", code: 500 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [targetUrl, init] = fetchSpy.mock.calls[0];
    expect(String(targetUrl)).toBe("https://alerts.example.test/webhook");
    const parsed = JSON.parse(String(init?.body || "{}"));
    expect(parsed.source).toBe("kotonoba");
    expect(parsed.severity).toBe("critical");
    expect(parsed.event).toBe("test.cooldown.event");
  });
});
