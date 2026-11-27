let warnedDevJwt = false;
let warnedDevEncryption = false;

/**
 * Returns the JWT/session signing secret.
 *
 * Production deployments must provide an explicit secret of at least 32
 * characters. A development fallback keeps local setup usable but is never
 * accepted in production, so a missing environment variable fails closed.
 *
 * @returns Validated secret string.
 * @throws {Error} When production is missing a sufficiently strong secret.
 */
export function getJwtSecretString(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
    }
    if (!warnedDevJwt && process.env.NODE_ENV !== "test") {
      warnedDevJwt = true;
      console.warn("[security] JWT_SECRET is missing or weak; using ephemeral development fallback.");
    }
    return secret || "dev-secret-change-me-in-production-32ch";
  }

  return secret;
}

/**
 * Returns the dedicated encryption secret used to protect stored third-party secrets.
 *
 * In production, `ENCRYPTION_KEY` must be configured independently of `JWT_SECRET`
 * and contain at least 32 characters.
 *
 * @returns Validated encryption secret material.
 * @throws {Error} When production lacks an explicit `ENCRYPTION_KEY` or reuses `JWT_SECRET`.
 */
export function getEncryptionSecretString(): string {
  const secret = process.env.ENCRYPTION_KEY?.trim();

  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY must be set to at least 32 characters in production.");
    }
    if (!warnedDevEncryption && process.env.NODE_ENV !== "test") {
      warnedDevEncryption = true;
      console.warn("[security] ENCRYPTION_KEY is missing or weak; using development fallback.");
    }
    return secret || "dev-encryption-key-change-me-in-prod-32ch";
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && jwtSecret && secret === jwtSecret) {
    throw new Error("ENCRYPTION_KEY must be distinct from JWT_SECRET in production.");
  }

  return secret;
}

/**
 * Returns the active key identifier stamped onto newly encrypted payloads.
 *
 * @returns Key version identifier (defaults to `k1`).
 */
export function getEncryptionKeyId(): string {
  const raw = process.env.ENCRYPTION_KEY_ID?.trim();
  return raw && /^[a-zA-Z0-9_-]{1,16}$/.test(raw) ? raw : "k1";
}
