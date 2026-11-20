import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, getRequestHost, verifyBearerSecret } from "@/lib/http/request";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("trusted proxy IP and host resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores spoofable x-forwarded-for when no proxy allowlist is configured", () => {
    vi.stubEnv("TRUSTED_PROXY_IPS", "");

    expect(
      getClientIp(headers({ "x-forwarded-for": "198.51.100.9, 203.0.113.4" }))
    ).toBe("unknown");

    expect(
      getClientIp(
        headers({
          "x-forwarded-for": "198.51.100.9",
          "x-real-ip": "203.0.113.7",
        })
      )
    ).toBe("203.0.113.7");
  });

  it("normalizes IPv6-mapped IPv4 addresses and rejects malformed values", () => {
    vi.stubEnv("TRUSTED_PROXY_IPS", "");

    expect(getClientIp(headers({ "x-real-ip": "::ffff:192.0.2.15" }))).toBe("192.0.2.15");
    expect(getClientIp(headers({ "x-real-ip": "not-an-ip" }))).toBe("unknown");
  });

  it("uses the right-most untrusted forwarded hop when proxies are trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_IPS", "10.0.0.0/8");

    expect(
      getClientIp(
        headers({
          "x-forwarded-for": "198.51.100.23, 10.1.2.3, 10.4.5.6",
        })
      )
    ).toBe("198.51.100.23");

    expect(
      getClientIp(
        headers({
          "x-forwarded-for": "203.0.113.50, 10.1.2.3",
          "x-real-ip": "10.1.2.3",
        })
      )
    ).toBe("203.0.113.50");
  });

  it("prefers the Host header over x-forwarded-host unless a proxy is trusted", () => {
    vi.stubEnv("TRUSTED_PROXY_IPS", "");

    expect(
      getRequestHost(
        headers({
          host: "blog.example.com",
          "x-forwarded-host": "attacker.example.net",
        })
      )
    ).toBe("blog.example.com");

    vi.stubEnv("TRUSTED_PROXY_IPS", "172.18.0.0/16");

    expect(
      getRequestHost(
        headers({
          host: "internal:3000",
          "x-forwarded-host": "blog.example.com",
        })
      )
    ).toBe("blog.example.com");
  });

  it("verifies bearer secrets in constant time and fails closed on missing credentials", () => {
    expect(verifyBearerSecret(headers({ authorization: "Bearer super-cron-secret" }), "super-cron-secret")).toBe(true);
    expect(verifyBearerSecret(headers({ authorization: "bearer super-cron-secret" }), "super-cron-secret")).toBe(true);
    expect(verifyBearerSecret(headers({ authorization: "Bearer wrong-cron-secret" }), "super-cron-secret")).toBe(false);
    expect(verifyBearerSecret(headers({ authorization: "Bearer short" }), "super-cron-secret")).toBe(false);
    expect(verifyBearerSecret(headers({ authorization: "Basic dXNlcjpwYXNz" }), "super-cron-secret")).toBe(false);
    expect(verifyBearerSecret(headers({ authorization: "Bearer super-cron-secret" }), "")).toBe(false);
    expect(verifyBearerSecret(headers({ authorization: "Bearer super-cron-secret" }), null)).toBe(false);
  });
});
