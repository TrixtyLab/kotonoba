import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET = process.env.JWT_SECRET || "default-fallback-secret-for-encryption-32ch";

/**
 * Derives a 256-bit cryptographic key from the configured JWT_SECRET environment variable.
 *
 * @returns A 32-byte Buffer representing the derived AES encryption key.
 */
function getKey(): Buffer {
  return crypto.createHash("sha256").update(SECRET).digest();
}

/**
 * Encrypts sensitive plaintext strings (such as AI API keys and external secrets) using authenticated AES-256-GCM.
 * Formats the resulting cipher into a colon-delimited string containing the IV, auth tag, and ciphertext.
 *
 * @param plainText - The unencrypted sensitive string to protect.
 * @returns A colon-separated encrypted payload string formatted as `iv:authTag:ciphertext`.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an authenticated AES-256-GCM encrypted payload and verifies its integrity.
 *
 * @param encryptedPayload - The colon-separated encrypted payload string (`iv:authTag:ciphertext`).
 * @returns The original decrypted UTF-8 plaintext string, or an empty string if decryption/authentication fails.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return "";
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}
