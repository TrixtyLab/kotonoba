import type { Instrumentation } from "next";
import { assertServerBootConfig } from "@/lib/config/boot";

/**
 * Next.js server initialization hook verifying mandatory production security secrets at boot
 * so containers fail closed when started with missing, weak, or reused keys.
 */
export async function register(): Promise<void> {
  await assertServerBootConfig();
}

/**
 * Structured Next.js server error observer emitting secret-free JSON error diagnostics (`T5.4`).
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  console.error(
    JSON.stringify({
      type: "server_error",
      timestamp: new Date().toISOString(),
      message,
      digest: digest ?? null,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    })
  );
};
