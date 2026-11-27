import crypto from "crypto";
import {
  getEncryptionKeyId,
  getEncryptionSecretString,
  getJwtSecretString,
} from "@/lib/config/secrets";
import { getPreviousEncryptionKeyEnv } from "@/lib/config/env";

const ALGORITHM = "aes-256-gcm";
const LEGACY_HEX_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

function deriveAesKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptWithKey(key: Buffer, ivHex: string, authTagHex: string, encryptedHex: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Checks whether a stored string already matches a Kotonoba encrypted secret envelope
 * (`v2:<keyId>:<iv>:<tag>:<ciphertext>` or legacy `<iv>:<tag>:<ciphertext>`).
 *
 * @param value - Candidate stored string.
 * @returns `true` if formatted as an encrypted secret payload.
 */
export function isEncryptedSecret(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("v2:")) {
    return value.split(":").length === 5;
  }
  return LEGACY_HEX_PATTERN.test(value);
}

/**
 * Encrypts sensitive plaintext strings (API keys, webhook URLs, S3 secrets, app passwords)
 * using authenticated AES-256-GCM with the dedicated `ENCRYPTION_KEY` and key identifier.
 *
 * @param plainText - The unencrypted sensitive string to protect.
 * @returns Versioned payload formatted as `v2:<keyId>:<iv>:<authTag>:<ciphertext>`.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey(getEncryptionSecretString());
  const keyId = getEncryptionKeyId();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `v2:${keyId}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a `v2:` or legacy 3-part AES-256-GCM encrypted payload and verifies its integrity.
 * Supports smooth key migration from legacy `JWT_SECRET`-encrypted records as fallback.
 *
 * @param encryptedPayload - Encrypted payload string.
 * @returns Decrypted UTF-8 plaintext string, or empty string if verification fails.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return "";

  try {
    if (encryptedPayload.startsWith("v2:")) {
      const parts = encryptedPayload.split(":");
      if (parts.length !== 5) return "";
      const [, , ivHex, authTagHex, encryptedHex] = parts;

      try {
        return decryptWithKey(deriveAesKey(getEncryptionSecretString()), ivHex, authTagHex, encryptedHex);
      } catch {
        const previousKey = getPreviousEncryptionKeyEnv();
        if (previousKey && previousKey.length >= 32) {
          return decryptWithKey(deriveAesKey(previousKey), ivHex, authTagHex, encryptedHex);
        }
        return "";
      }
    }

    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encryptedHex] = parts;

    // Legacy 3-part payloads were originally encrypted using SHA-256(JWT_SECRET).
    try {
      return decryptWithKey(deriveAesKey(getJwtSecretString()), ivHex, authTagHex, encryptedHex);
    } catch {
      return decryptWithKey(deriveAesKey(getEncryptionSecretString()), ivHex, authTagHex, encryptedHex);
    }
  } catch {
    return "";
  }
}

/**
 * Decrypts encrypted secrets while permitting pre-upgrade legacy plaintext database values
 * so existing integrations keep working seamlessly until re-saved under encryption.
 *
 * @param value - Stored setting value.
 * @returns Plaintext string or empty string if encrypted decryption fails.
 */
export function decryptSecretOrLegacyPlaintext(value: string | null | undefined): string {
  if (!value) return "";
  if (isEncryptedSecret(value)) {
    return decryptSecret(value);
  }
  return value;
}

/**
 * Produces a non-sensitive masked display hint for UI inputs without leaking full secrets.
 *
 * @param plainText - Decrypted secret string.
 * @returns Short masked string (e.g. `sk-p...9a2f`).
 */
export function maskSecretHint(plainText: string): string {
  const trimmed = plainText.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
