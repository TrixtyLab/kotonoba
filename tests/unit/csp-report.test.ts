import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/csp-report/route";

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://site-a.test/api/csp-report", {
    method: "POST",
    headers: {
      "content-type": "application/csp-report",
      "x-real-ip": "203.0.113.9",
      ...headers,
    },
    body,
  });
}

describe("CSP violation report endpoint", () => {
  it("accepts legacy csp-report and Reporting API payloads", async () => {
    const legacy = await POST(
      makeRequest(
        JSON.stringify({
          "csp-report": {
            "document-uri": "https://site-a.test/entry/post",
            "blocked-uri": "inline",
            "violated-directive": "script-src",
          },
        })
      )
    );
    expect(legacy.status).toBe(204);

    const modern = await POST(
      makeRequest(
        JSON.stringify([
          {
            type: "csp-violation",
            body: {
              "document-uri": "https://site-a.test/entry/post",
              "blocked-uri": "eval",
              "effective-directive": "script-src",
            },
          },
        ])
      )
    );
    expect(modern.status).toBe(204);
  });

  it("rejects malformed and oversized payloads", async () => {
    const malformed = await POST(makeRequest("{"));
    expect(malformed.status).toBe(400);

    const oversized = await POST(
      makeRequest(JSON.stringify({ "csp-report": { "document-uri": "x".repeat(20_000) } }))
    );
    expect(oversized.status).toBe(413);
  });
});
