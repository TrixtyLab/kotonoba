import crypto from "crypto";
import { getBackupEncryptionEnv } from "@/lib/config/env";

/** Magic prefix identifying an encrypted Kotonoba backup. */
const MAGIC = Buffer.from("KOTONOBA-BACKUP-V1\n", "utf8");

/** AES-GCM initialization vector length in bytes. */
const IV_LENGTH = 12;

/** AES-GCM authentication tag length in bytes. */
const TAG_LENGTH = 16;

/** Result of encrypting a backup archive. */
export interface EncryptedBackup {
  /** Encrypted archive bytes, including header, ciphertext and auth tag. */
  buffer: Buffer;
  /** Identifier of the key used, stored in the header for rotation. */
  keyId: string;
}

/**
 * Reads and validates the backup encryption key from the environment.
 *
 * The key must be 32 bytes, encoded either as base64 or as 64 hex characters.
 * Backup operations fail closed when the key is missing or malformed.
 *
 * @returns Parsed encryption key and its configured identifier.
 * @throws {Error} When `BACKUP_ENCRYPTION_KEY` is missing or invalid.
 */
function getBackupEncryptionConfig(): { key: Buffer; keyId: string } {
  const { rawKey, keyId } = getBackupEncryptionEnv();
  if (!rawKey) {
    throw new Error("BACKUP_ENCRYPTION_KEY is required to export or restore backups.");
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    key = Buffer.from(rawKey, "hex");
  } else {
    key = Buffer.from(rawKey, "base64");
  }

  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  if (!/^[A-Za-z0-9._-]{1,32}$/.test(keyId)) {
    throw new Error("BACKUP_KEY_ID must be 1-32 characters (letters, numbers, dot, dash, underscore).");
  }

  return { key, keyId };
}

/**
 * Checks whether a buffer starts with the encrypted backup magic header.
 *
 * @param buffer - Candidate backup archive.
 * @returns `true` when the buffer is an encrypted Kotonoba backup.
 */
export function isEncryptedBackup(buffer: Buffer): boolean {
  return buffer.length > MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

/**
 * Encrypts a ZIP archive with AES-256-GCM.
 *
 * Layout: magic header, key ID length, key ID, IV, ciphertext, auth tag.
 * The header is authenticated as additional data so the key identifier cannot
 * be swapped without invalidating the archive.
 *
 * @param archive - Plain ZIP bytes produced by the backup exporter.
 * @returns Encrypted archive and the key identifier used.
 * @throws {Error} When no valid encryption key is configured.
 */
export function encryptBackupArchive(archive: Buffer): EncryptedBackup {
  const { key, keyId } = getBackupEncryptionConfig();
  const keyIdBytes = Buffer.from(keyId, "utf8");
  if (keyIdBytes.length > 255) {
    throw new Error("BACKUP_KEY_ID is too long.");
  }

  const header = Buffer.concat([MAGIC, Buffer.from([keyIdBytes.length]), keyIdBytes]);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);

  const ciphertext = Buffer.concat([cipher.update(archive), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    buffer: Buffer.concat([header, iv, ciphertext, tag]),
    keyId,
  };
}

/**
 * Decrypts an encrypted Kotonoba backup archive.
 *
 * @param buffer - Encrypted backup bytes.
 * @returns Plain ZIP archive bytes.
 * @throws {Error} When the header, key or authentication tag is invalid.
 */
export function decryptBackupArchive(buffer: Buffer): Buffer {
  if (!isEncryptedBackup(buffer)) {
    throw new Error("Unsupported backup format.");
  }

  const { key } = getBackupEncryptionConfig();
  let offset = MAGIC.length;

  if (buffer.length < offset + 1 + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Backup archive is truncated.");
  }

  const keyIdLength = buffer[offset];
  offset += 1;

  if (buffer.length < offset + keyIdLength + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Backup archive is truncated.");
  }

  const header = buffer.subarray(0, offset + keyIdLength);
  offset += keyIdLength;

  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(offset, buffer.length - TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Backup decryption failed: wrong key or corrupted archive.");
  }
}

export { isLegacyBackupImportEnabled } from "@/lib/config/features";
