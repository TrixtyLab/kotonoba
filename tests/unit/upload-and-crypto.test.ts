import crypto from "crypto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { detectImageTypeFromBytes, sanitizeUploadedImage } from "@/lib/security/upload";
import {
  decryptSecret,
  decryptSecretOrLegacyPlaintext,
  encryptSecret,
  isEncryptedSecret,
  maskSecretHint,
} from "@/lib/security/crypto";

describe("detectImageTypeFromBytes", () => {
  it("detects authentic JPEG, PNG, GIF, and WebP headers regardless of filename", () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageTypeFromBytes(jpg)).toEqual({ mimeType: "image/jpeg", extension: ".jpg" });

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageTypeFromBytes(png)).toEqual({ mimeType: "image/png", extension: ".png" });

    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00", "binary");
    expect(detectImageTypeFromBytes(gif)).toEqual({ mimeType: "image/gif", extension: ".gif" });

    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
    expect(detectImageTypeFromBytes(webp)).toEqual({ mimeType: "image/webp", extension: ".webp" });
  });

  it("rejects HTML, SVG scripts, or arbitrary files disguised as images", () => {
    expect(detectImageTypeFromBytes(Buffer.from("<svg onload='alert(1)'>"))).toBeNull();
    expect(detectImageTypeFromBytes(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectImageTypeFromBytes(Buffer.from("tiny"))).toBeNull();
  });

  it("re-encodes valid raster payloads via sharp, strips trailing polyglot data, and rejects truncated images", async () => {
    const validPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const polyglotPng = Buffer.concat([validPng, Buffer.from("<script>alert('polyglot')</script>")]);
    const sanitized = await sanitizeUploadedImage(polyglotPng, {
      mimeType: "image/png",
      extension: ".png",
    });

    expect(sanitized).not.toBeNull();
    expect(sanitized!.width).toBe(1);
    expect(sanitized!.height).toBe(1);
    expect(sanitized!.buffer.includes(Buffer.from("<script>"))).toBe(false);

    const truncatedHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]);
    expect(
      await sanitizeUploadedImage(truncatedHeader, { mimeType: "image/png", extension: ".png" })
    ).toBeNull();
  });
});

describe("Secret encryption separation (ENCRYPTION_KEY vs JWT_SECRET)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("encrypts secrets in v2 envelope with ENCRYPTION_KEY_ID and round-trips", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.JWT_SECRET = "jwt-secret-must-be-at-least-32-characters-long-aaa";
    process.env.ENCRYPTION_KEY = "encryption-key-must-be-different-32-chars-bbb";
    process.env.ENCRYPTION_KEY_ID = "k2";

    const cipher = encryptSecret("https://discord.com/api/webhooks/123/secretToken");
    expect(cipher.startsWith("v2:k2:")).toBe(true);
    expect(isEncryptedSecret(cipher)).toBe(true);
    expect(decryptSecret(cipher)).toBe("https://discord.com/api/webhooks/123/secretToken");
    expect(maskSecretHint("sk-1234567890abcdef")).toBe("sk-1...cdef");
  });

  it("fails closed in production when ENCRYPTION_KEY is missing or identical to JWT_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.JWT_SECRET = "same-secret-32-characters-long-testing-value";
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("secret")).toThrow(/ENCRYPTION_KEY/);

    process.env.ENCRYPTION_KEY = "same-secret-32-characters-long-testing-value";
    expect(() => encryptSecret("secret")).toThrow(/distinct from JWT_SECRET/);
  });

  it("preserves legacy 3-part JWT_SECRET ciphertexts and legacy plaintext webhooks on read", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.JWT_SECRET = "legacy-jwt-secret-32-chars-long-value";
    process.env.ENCRYPTION_KEY = "new-dedicated-encryption-key-32-chars-value";

    // Produce legacy 3-part ciphertext under JWT_SECRET key derivation
    const legacyKey = crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", legacyKey, iv);
    const encrypted = cipher.update("my-old-api-key", "utf8", "hex") + cipher.final("hex");
    const legacyPayload = `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted}`;

    expect(isEncryptedSecret(legacyPayload)).toBe(true);
    expect(decryptSecret(legacyPayload)).toBe("my-old-api-key");
    expect(decryptSecretOrLegacyPlaintext("https://discord.com/api/webhooks/1/2")).toBe(
      "https://discord.com/api/webhooks/1/2"
    );
  });
});
