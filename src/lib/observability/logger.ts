/**
 * Structured JSON logging with best-effort redaction of credentials and personal data.
 *
 * Logs are intentionally emitted as one JSON object per line so Docker, systemd, or a
 * log shipper can index fields such as `requestId`, `siteId`, `route`, and `durationMs`.
 */

/** Severity levels supported by the application logger. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Contextual fields attached to a structured log entry. */
export interface LogContext {
  requestId?: string;
  siteId?: string;
  route?: string;
  action?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|credential/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 2_000;

/**
 * Masks email addresses so operational logs never retain account identifiers verbatim.
 *
 * @param value - Arbitrary string that may contain an email address.
 * @returns String with local parts replaced by `***`.
 */
function maskEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, (match) => {
    const at = match.indexOf("@");
    return at > 0 ? `***${match.slice(at)}` : "***";
  });
}

/**
 * Recursively redacts secrets and truncates oversized values before logging.
 *
 * @param value - Raw context value.
 * @param depth - Current recursion depth.
 * @returns JSON-safe, redacted representation.
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    const masked = maskEmails(value);
    return masked.length > MAX_STRING_LENGTH
      ? `${masked.slice(0, MAX_STRING_LENGTH)}…`
      : masked;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: maskEmails(value.message) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : redact(nested, depth + 1);
    }
    return output;
  }

  return String(value);
}

/**
 * Writes one structured JSON log line.
 *
 * @param level - Severity level.
 * @param event - Stable event name, for example `backup.export.failed`.
 * @param context - Optional fields merged into the log entry.
 */
export function logEvent(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = {
    type: "app",
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(redact(context) as Record<string, unknown>),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * Logs an unexpected error with a stable event name and redacted context.
 *
 * @param event - Stable event name describing the failed operation.
 * @param error - Caught value.
 * @param context - Optional fields merged into the log entry.
 */
export function logError(event: string, error: unknown, context: LogContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  logEvent("error", event, {
    ...context,
    error: maskEmails(message),
  });
}
