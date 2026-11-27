import { NextRequest, NextResponse } from "next/server";
import { ROLES } from "@/lib/config/constants";
import { getEnvConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestId, verifyBearerSecret } from "@/lib/http/request";
import { logEvent } from "@/lib/observability/logger";

/**
 * Authorizes a cron request through `CRON_SECRET` or an active `super_admin` session.
 *
 * @param req - Incoming cron request.
 * @param route - Route name used for structured logging.
 * @returns `null` when authorized, otherwise the rejection response.
 */
export async function authorizeCronRequest(
  req: NextRequest,
  route: string
): Promise<NextResponse | null> {
  const { cronSecret, nodeEnv } = getEnvConfig();

  if (verifyBearerSecret(req.headers, cronSecret)) return null;

  const user = await getCurrentUser();
  if (user?.exists && user.role === ROLES.SUPER_ADMIN) return null;

  if (!cronSecret && nodeEnv === "production") {
    logEvent("error", "cron.unconfigured", { route, requestId: getRequestId(req.headers) });
    return NextResponse.json(
      { error: "CRON_SECRET is not configured in production." },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
