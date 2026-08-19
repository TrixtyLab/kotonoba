import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me-in-production-32ch"
);

/**
 * Standard JWT session payload representing an authenticated user identity and scope.
 */
export interface TokenPayload extends JWTPayload {
  /** Unique database identifier of the user account. */
  userId: string;
  /** Primary email address associated with the user account. */
  email: string;
  /** Authorization role assigned to the user (e.g., 'super_admin', 'admin', 'editor', 'author'). */
  role: string;
  /** Associated site identifier for tenancy scoping, or null if globally scoped. */
  siteId: string | null;
}

/**
 * Parses standard human-readable duration strings into integer seconds.
 * Supports units: s (seconds), m (minutes), h (hours), d (days), w (weeks), y (years).
 *
 * @param duration - A duration string such as '30d', '24h', '60m', '3600s'.
 * @returns Total duration in seconds, defaulting to 30 days (2592000s) on invalid formats.
 */
export function parseDurationToSeconds(duration: string): number {
  if (!duration) return 60 * 60 * 24 * 30;
  const trimmed = duration.trim();
  const match = trimmed.match(/^(\d+)([smhdwy]?)$/i);
  if (!match) return 60 * 60 * 24 * 30;

  const value = parseInt(match[1], 10);
  const unit = (match[2] || "s").toLowerCase();

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    case "w":
      return value * 604800;
    case "y":
      return value * 31536000;
    default:
      return value * 86400;
  }
}

/**
 * Resolves the configured session access token expiration string and maximum cookie age in seconds.
 *
 * @returns An object containing the duration string expression and computed seconds.
 */
export function getSessionDuration(): { expiresIn: string; maxAgeSeconds: number } {
  const expiresIn = process.env.SESSION_DURATION || process.env.JWT_EXPIRES_IN || "30d";
  const maxAgeSeconds = parseDurationToSeconds(expiresIn);
  return { expiresIn, maxAgeSeconds };
}

/**
 * Resolves the configured refresh token duration expression and maximum cookie age in seconds.
 *
 * @returns An object containing the duration string expression and computed seconds.
 */
export function getRefreshDuration(): { expiresIn: string; maxAgeSeconds: number } {
  const expiresIn = process.env.REFRESH_DURATION || process.env.REFRESH_EXPIRES_IN || "90d";
  const maxAgeSeconds = parseDurationToSeconds(expiresIn);
  return { expiresIn, maxAgeSeconds };
}

/**
 * Cryptographically signs and issues an HS256 access token containing the user session claims.
 *
 * @param payload - The user identity claims to embed into the token.
 * @param expiresInOverride - Optional custom expiration duration string to override the default.
 * @returns A Promise resolving to the signed JWT string.
 */
export async function signAccessToken(
  payload: Omit<TokenPayload, keyof JWTPayload>,
  expiresInOverride?: string
): Promise<string> {
  const { expiresIn } = getSessionDuration();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresInOverride || expiresIn)
    .sign(JWT_SECRET);
}

/**
 * Cryptographically signs and issues a long-lived refresh token for silent session renewal.
 *
 * @param userId - Unique database identifier of the user account.
 * @param expiresInOverride - Optional custom expiration duration string to override default.
 * @returns A Promise resolving to the signed refresh JWT string.
 */
export async function signRefreshToken(
  userId: string,
  expiresInOverride?: string
): Promise<string> {
  const { expiresIn } = getRefreshDuration();
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresInOverride || expiresIn)
    .sign(JWT_SECRET);
}

/**
 * Verifies the cryptographic signature and expiration validity of a JWT string.
 *
 * @param token - The raw JWT token string to verify.
 * @returns A Promise resolving to the decoded TokenPayload if valid, or null if expired/invalid.
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
