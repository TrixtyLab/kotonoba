import { requireAuth } from "@/lib/auth/session";
import type { TokenPayload } from "@/lib/auth/jwt";
import { checkRateLimit, type RateLimitConfig, RATE_LIMITS } from "./rate-limit";
import { NextRequest, NextResponse } from "next/server";

export type AuthUser = TokenPayload;

export type GuardParam = string | number | boolean | object | null | undefined | string[] | number[] | object[];

export function withAuth<T extends GuardParam[], R>(
  roles: string[],
  handler: (user: AuthUser, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const user = await requireAuth(roles);
    return handler(user, ...args);
  };
}

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
