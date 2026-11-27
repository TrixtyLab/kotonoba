import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getRequestId } from "@/lib/http/request";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logEvent } from "@/lib/observability/logger";

/** Maximum accepted CSP report payload, in bytes. */
const MAX_BODY_BYTES = 16 * 1024;

/** Maximum length stored for any single report field. */
const MAX_FIELD_LENGTH = 512;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  return cleaned ? cleaned.slice(0, MAX_FIELD_LENGTH) : null;
}

/**
 * Extracts the legacy `csp-report` object or the Reporting API `csp-violation` body.
 *
 * @param payload - Parsed JSON request body.
 * @returns Flat report record, or `null` when the shape is unknown.
 */
function extractReport(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    const entry = payload.find(
      (item) => isRecord(item) && item.type === "csp-violation" && isRecord(item.body)
    );
    return entry && isRecord(entry) && isRecord(entry.body) ? entry.body : null;
  }
  if (!isRecord(payload)) return null;
  if (isRecord(payload["csp-report"])) return payload["csp-report"];
  return payload;
}

/**
 * Collects browser CSP violation reports for enforcement-mode validation.
 *
 * The endpoint is write-only: it never echoes input, caps payload size, rate limits
 * by client IP, and logs a fixed allowlist of fields through the structured logger.
 *
 * @param req - Incoming CSP report request.
 * @returns Empty `204` on acceptance, `400` on malformed JSON, `413` when oversized, or `429` when rate limited.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(req.headers);
  const rate = checkRateLimit(`csp-report:${clientIp}`, RATE_LIMITS.csp);
  if (!rate.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfter) },
    });
  }

  const declaredLength = Number.parseInt(req.headers.get("content-length") || "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    payload = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const report = extractReport(payload);
  if (report) {
    logEvent("warn", "csp.violation", {
      route: "/api/csp-report",
      requestId: getRequestId(req.headers),
      documentUri: readField(report["document-uri"]),
      blockedUri: readField(report["blocked-uri"]),
      violatedDirective: readField(report["violated-directive"]),
      effectiveDirective: readField(report["effective-directive"]),
      sourceFile: readField(report["source-file"]),
      lineNumber: typeof report["line-number"] === "number" ? report["line-number"] : null,
      disposition: readField(report["disposition"]),
    });
  }

  return new NextResponse(null, { status: 204 });
}
