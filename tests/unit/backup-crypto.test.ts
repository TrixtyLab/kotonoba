import crypto from "crypto";
import { describe, it, expect, afterEach } from "vitest";
import {
  encryptBackupArchive,
  decryptBackupArchive,
  isEncryptedBackup,
  isLegacyBackupImportEnabled,
} from "@/lib/backup/crypto";

describe("backup encryption", () => {
  const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
  const originalKeyId = process.env.BACKUP_KEY_ID;
  const originalLegacy = process.env.ALLOW_LEGACY_BACKUP_IMPORT;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = originalKey;

    if (originalKeyId === undefined) delete process.env.BACKUP_KEY_ID;
    else process.env.BACKUP_KEY_ID = originalKeyId;

    if (originalLegacy === undefined) delete process.env.ALLOW_LEGACY_BACKUP_IMPORT;
    else process.env.ALLOW_LEGACY_BACKUP_IMPORT = originalLegacy;
  });

  it("fails closed when BACKUP_ENCRYPTION_KEY is missing or malformed", () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    expect(() => encryptBackupArchive(Buffer.from("zip-bytes"))).toThrow();

    process.env.BACKUP_ENCRYPTION_KEY = "too-short";
    expect(() => encryptBackupArchive(Buffer.from("zip-bytes"))).toThrow();
  });

  it("round-trips encrypted backups with base64 and hex keys", () => {
    const plain = Buffer.from("PK\x03\x04test-archive-payload");

    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
    process.env.BACKUP_KEY_ID = "k2026";

    const encrypted = encryptBackupArchive(plain);
    expect(encrypted.keyId).toBe("k2026");
    expect(isEncryptedBackup(encrypted.buffer)).toBe(true);
    expect(decryptBackupArchive(encrypted.buffer)).toEqual(plain);

    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const hexEncrypted = encryptBackupArchive(plain);
    expect(decryptBackupArchive(hexEncrypted.buffer)).toEqual(plain);
  });

  it("rejects tampered ciphertext or wrong decryption key", () => {
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const encrypted = encryptBackupArchive(Buffer.from("secret-site-dump"));

    const tampered = Buffer.from(encrypted.buffer);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptBackupArchive(tampered)).toThrow();

    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    expect(() => decryptBackupArchive(encrypted.buffer)).toThrow();
  });

  it("controls legacy unencrypted ZIP support via feature flag", () => {
    delete process.env.ALLOW_LEGACY_BACKUP_IMPORT;
    expect(isLegacyBackupImportEnabled()).toBe(false);
    process.env.ALLOW_LEGACY_BACKUP_IMPORT = "true";
    expect(isLegacyBackupImportEnabled()).toBe(true);
  });
});
