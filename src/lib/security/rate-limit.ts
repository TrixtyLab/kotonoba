/**
 * In-memory sliding window rate limiter.
 * No Redis needed — suitable for single-instance Docker deployment.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, window] of windows) {
    if (window.resetAt < now) windows.delete(key);
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  default: { maxRequests: 100, windowMs: 60_000 },
  auth: { maxRequests: 10, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  analytics: { maxRequests: 60, windowMs: 60_000 },
  ai: { maxRequests: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitConfig>;

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
