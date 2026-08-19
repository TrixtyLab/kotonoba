import { requireAuth } from "@/lib/auth/session";
import type { TokenPayload } from "@/lib/auth/jwt";
import { checkRateLimit, type RateLimitConfig, RATE_LIMITS } from "./rate-limit";
import { NextRequest, NextResponse } from "next/server";

/**
 * Authenticated user payload extracted from a verified session token.
 */
export type AuthUser = TokenPayload;

/**
 * Flexible parameter type constraint for wrapped server action handlers.
 */
export type GuardParam = string | number | boolean | object | null | undefined | string[] | number[] | object[];

/**
 * Higher-order function that wraps a Server Action handler with role-based access control.
 * Verifies that the active request possesses a valid session matching at least one authorized role.
 *
 * @param roles - Array of authorized role names (e.g., ['super_admin', 'admin', 'editor']).
 * @param handler - The target asynchronous action handler function to execute upon successful authentication.
 * @returns A wrapped asynchronous function enforcing authentication before delegating to the handler.
 * @throws {Error} When authentication fails or the authenticated user lacks the required role.
 */
export function withAuth<T extends GuardParam[], R>(
  roles: string[],
  handler: (user: AuthUser, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const user = await requireAuth(roles);
    return handler(user, ...args);
  };
}

/**
 * Higher-order function that wraps a Next.js API Route handler with IP-based sliding window rate limiting.
 *
 * @param handler - The target Next.js Route handler function to protect.
 * @param config - Rate limiting configuration specifying window size and maximum allowed requests. Defaults to default tier.
 * @returns A wrapped route handler that checks request limits and sets standard HTTP rate limit headers.
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.default
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = rawIp && rawIp.length > 0 ? rawIp : "127.0.0.1";
    const result = checkRateLimit(ip, config);

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const response = await handler(req);
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    return response;
  };
}
