const windows = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

/**
 * Periodically sweeps and removes expired rate limiting records from the in-memory store.
 *
 * @returns Void.
 */
function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, window] of windows) {
    if (window.resetAt < now) windows.delete(key);
  }
}

/**
 * Rate limit policy configuration specifying the request threshold and rolling window duration.
 */
export interface RateLimitConfig {
  /** Maximum number of allowed requests within the defined time window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/**
 * Predefined rate limiting configurations categorized by route sensitivity.
 */
export const RATE_LIMITS = {
  default: { maxRequests: 100, windowMs: 60_000 },
  auth: { maxRequests: 10, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  analytics: { maxRequests: 60, windowMs: 60_000 },
  ai: { maxRequests: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitConfig>;

/**
 * Evaluates whether an incoming request from a specific identifier (such as an IP address) exceeds the configured rate limit.
 *
 * @param key - The unique tracking key, typically the client IP or user ID.
 * @param config - The rate limit configuration rule to apply. Defaults to the default tier.
 * @returns An evaluation object indicating whether the request is allowed, remaining requests, and retry delay in seconds.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; remaining: number; retryAfter: number } {
  cleanup();
  const now = Date.now();
  const window = windows.get(key);

  if (!window || window.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfter: 0 };
  }

  if (window.count >= config.maxRequests) {
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  window.count++;
  return { allowed: true, remaining: config.maxRequests - window.count, retryAfter: 0 };
}
