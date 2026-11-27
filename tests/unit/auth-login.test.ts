import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyPassword = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/auth/password", () => ({
  LOGIN_TIMING_PASSWORD_HASH:
    "$argon2id$v=19$m=65536,t=3,p=4$sXbiChaub0lWmbh6P1N+cg$SoLgKwWz/B9Vj6yKskY0s/9BHuMz8p9sXEebykKxgxI",
  verifyPassword,
  hashPassword: vi.fn(),
}));

import { LOGIN_TIMING_PASSWORD_HASH } from "@/lib/auth/password";
import { authenticateWithPasswordService } from "@/lib/services/auth";
import { resetRateLimitStore } from "@/lib/security/rate-limit";
import { createTempDb, type TempDbContext } from "../helpers/db";

describe("password login rate limits and timing", () => {
  let ctx: TempDbContext | null = null;

  beforeEach(() => {
    verifyPassword.mockClear();
    verifyPassword.mockResolvedValue(false);
    resetRateLimitStore();
    ctx = createTempDb("kotonoba-login");
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("verifies a fixed hash when the email is unknown", async () => {
    const result = await authenticateWithPasswordService(
      { email: "missing@example.com", password: "Password1" },
      "203.0.113.21"
    );

    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error).toBe("Invalid email or password");
    }
    expect(verifyPassword).toHaveBeenCalledWith(LOGIN_TIMING_PASSWORD_HASH, "Password1");
  });

  it("shares one IP bucket across different emails", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await authenticateWithPasswordService(
        { email: `person-${attempt}@example.com`, password: "Password1" },
        "203.0.113.40"
      );
      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error).toBe("Invalid email or password");
      }
    }

    const blocked = await authenticateWithPasswordService(
      { email: "someone-else@example.com", password: "Password1" },
      "203.0.113.40"
    );
    expect(blocked.response.success).toBe(false);
    if (!blocked.response.success) {
      expect(blocked.response.error).toMatch(/Too many login attempts/);
    }

    const otherIp = await authenticateWithPasswordService(
      { email: "fresh@example.com", password: "Password1" },
      "203.0.113.41"
    );
    expect(otherIp.response.success).toBe(false);
    if (!otherIp.response.success) {
      expect(otherIp.response.error).toBe("Invalid email or password");
    }
  });
});
