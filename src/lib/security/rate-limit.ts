const CLEANUP_INTERVAL = 60_000;
const MAX_IN_MEMORY_WINDOWS = 10_000;

/**
 * Rate limit policy configuration specifying the request threshold and rolling window duration.
 */
export interface RateLimitConfig {
  /** Maximum number of allowed requests within the defined time window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/** Result returned when checking/consuming a quota token from a {@link RateLimitStore}. */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/** Pluggable backing store contract for single-node or shared Redis rate limiting. */
export interface RateLimitStore {
  consume(key: string, config: RateLimitConfig, nowMs?: number): RateLimitResult;
}

/**
 * Predefined rate limiting configurations categorized by route sensitivity.
 */
export const RATE_LIMITS = {
  default: { maxRequests: 100, windowMs: 60_000 },
  auth: { maxRequests: 10, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  analytics: { maxRequests: 120, windowMs: 60_000 },
  csp: { maxRequests: 60, windowMs: 60_000 },
  ai: { maxRequests: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitConfig>;

/**
 * Bounded process-local rate limit store evicting expired windows and capping active buckets
 * to protect single-instance deployments against unbounded memory growth.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private readonly maxEntries: number;
  private lastCleanup = Date.now();

  constructor(maxEntries = MAX_IN_MEMORY_WINDOWS) {
    this.maxEntries = Math.max(100, maxEntries);
  }

  private sweepExpired(now: number, force = false): void {
    if (!force && now - this.lastCleanup < CLEANUP_INTERVAL) return;
    this.lastCleanup = now;
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
  }

  private ensureCapacity(now: number): void {
    if (this.windows.size < this.maxEntries) return;
    this.sweepExpired(now, true);
    while (this.windows.size >= this.maxEntries) {
      const oldestKey = this.windows.keys().next().value;
      if (oldestKey === undefined) break;
      this.windows.delete(oldestKey);
    }
  }

  consume(key: string, config: RateLimitConfig, nowMs = Date.now()): RateLimitResult {
    this.sweepExpired(nowMs);
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= nowMs) {
      this.ensureCapacity(nowMs);
      this.windows.set(key, { count: 1, resetAt: nowMs + config.windowMs });
      return { allowed: true, remaining: Math.max(0, config.maxRequests - 1), retryAfter: 0 };
    }

    if (existing.count >= config.maxRequests) {
      const retryAfter = Math.ceil((existing.resetAt - nowMs) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    existing.count++;
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - existing.count),
      retryAfter: 0,
    };
  }
}

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

/** Swaps the active rate limiter backend (e.g. shared store or test double). */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

/** Restores the default bounded in-memory rate limit store. */
export function resetRateLimitStore(): void {
  activeStore = new InMemoryRateLimitStore();
}

/**
 * Evaluates whether an incoming request from a specific identifier exceeds the configured quota.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.default
): RateLimitResult {
  return activeStore.consume(key, config);
}
