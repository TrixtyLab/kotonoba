import dns from "dns/promises";
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  sanitizeCss,
  sanitizeNavLinksJson,
  sanitizeUrl,
} from "@/lib/security/sanitize";
import {
  isPrivateOrReservedIp,
  pinnedDnsLookup,
  validateOutboundUrl,
} from "@/lib/security/ssrf";
import { renderPostContent } from "@/lib/utils/markdown";
import { buildContentSecurityPolicy } from "@/lib/security/headers";
import { sanitizePath } from "@/lib/storage";

describe("URL, CSS, navigation, and markdown/HTML XSS protections", () => {
  it("sanitizes untrusted URLs while blocking dangerous schemes and protocol-relative bypasses", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("  JaVaScRiPt:alert(1) ")).toBeNull();
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(sanitizeUrl("//evil.example.com/phish")).toBeNull();
    expect(sanitizeUrl("/\\evil.example.com")).toBeNull();
    expect(sanitizeUrl("https://example.com/\nX-Header: bad")).toBeNull();

    expect(sanitizeUrl("/archive")).toBe("/archive");
    expect(sanitizeUrl("https://kotonoba.example.com/entry/hi")).toBe(
      "https://kotonoba.example.com/entry/hi"
    );
    expect(sanitizeUrl("mailto:team@example.com", { allowMailtoTel: true })).toBe(
      "mailto:team@example.com"
    );
  });

  it("strips unsafe links from navLinks JSON while preserving valid localized items", () => {
    const raw = JSON.stringify([
      { id: "about", label: "About", labels: { en: "About", es: "Acerca" }, url: "/p/about" },
      { id: "evil", label: "Hack", url: "javascript:alert(1)", isSocial: true },
      { id: "proto", label: "Proto", url: "//attacker.tld" },
      { id: "x", label: "X", url: "https://x.com/kotonoba", isSocial: true, target: "_blank" },
    ]);

    const clean = JSON.parse(sanitizeNavLinksJson(raw)) as Array<{ id: string; url: string }>;
    expect(clean.map((i) => i.id)).toEqual(["about", "x"]);
    expect(clean[0].url).toBe("/p/about");
  });

  it("sanitizes custom CSS against style injection and exfiltration directives", () => {
    const dirty = `
      </style><script>alert(1)</script>
      @import url("https://evil.tld/leak.css");
      body { background: expression(alert(1)); behavior: url(xss.htc); background-image: url(https://evil.tld/pixel.png); color: #fff; }
    `;
    const clean = sanitizeCss(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("</style");
    expect(clean.toLowerCase()).not.toContain("@import");
    expect(clean.toLowerCase()).not.toContain("expression(");
    expect(clean.toLowerCase()).not.toContain("behavior:");
    expect(clean.toLowerCase()).not.toContain("url(");
    expect(clean).toContain("color: #fff;");
  });

  it("strips HTML injection vectors regardless of HTML root tag attributes or markdown links", () => {
    const htmlWithAttr = `<p class="lead">Safe<img src="x" onerror="alert(1)"></p><script>alert(2)</script>`;
    const renderedHtml = renderPostContent(htmlWithAttr, { format: "html" });
    expect(renderedHtml).toContain("Safe");
    expect(renderedHtml).not.toContain("<script");
    expect(renderedHtml).not.toContain("onerror");

    const mdXss = `[Bad Link](javascript:alert(1))\n\n<script>alert(9)</script>\n\nHello **world**`;
    const renderedMd = renderPostContent(mdXss, { format: "markdown" });
    expect(renderedMd).not.toContain("javascript:");
    expect(renderedMd).not.toContain("<script");
    expect(renderedMd).toContain("world");
  });
});

describe("SSRF outbound URL protections", () => {
  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  it("identifies loopback, RFC1918, metadata, CGNAT, and IPv6 local addresses as private", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.10.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.4.2")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.50")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);

    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
  });

  it("blocks localhost, metadata URLs, credentials, non-HTTPS, and enforces domain allowlists", async () => {
    const r1 = await validateOutboundUrl("http://127.0.0.1:8080/secret", { skipDnsLookup: true });
    expect(r1.valid).toBe(false);

    const r2 = await validateOutboundUrl("https://169.254.169.254/latest/meta-data/", { skipDnsLookup: true });
    expect(r2.valid).toBe(false);

    const r3 = await validateOutboundUrl("https://user:pass@discord.com/api/webhooks/1/2", { skipDnsLookup: true });
    expect(r3.valid).toBe(false);

    const r4 = await validateOutboundUrl("https://evil.example.com/api/webhooks/1/2", {
      allowedDomains: ["discord.com", "discordapp.com"],
      skipDnsLookup: true,
    });
    expect(r4.valid).toBe(false);

    const r5 = await validateOutboundUrl("https://discord.com/api/webhooks/12345/abcdef", {
      allowedDomains: ["discord.com", "discordapp.com"],
      skipDnsLookup: true,
    });
    expect(r5.valid).toBe(true);
  });

  it("pins DNS lookup to the address chosen during validation", () => {
    const lookup = pinnedDnsLookup("1.1.1.1");
    lookup("example.com", { all: true }, (err, addresses) => {
      expect(err).toBeNull();
      expect(addresses).toEqual([{ address: "1.1.1.1", family: 4 }]);
    });
    lookup("example.com", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("1.1.1.1");
      expect(family).toBe(4);
    });
  });

  it("rejects a hostname that resolves to a mix of public and private addresses", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ] as never);

    const result = await validateOutboundUrl("https://example.com/hook");
    expect(result.valid).toBe(false);
    vi.restoreAllMocks();
  });

  it("builds strict nonce CSP headers and neutralizes storage path traversal segments", () => {
    const cspHttp = buildContentSecurityPolicy({ nonce: "abc123", isDev: false, isHttps: false });
    expect(cspHttp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(cspHttp).not.toContain("'unsafe-eval'");
    expect(cspHttp).toContain("object-src 'none'");
    expect(cspHttp).toContain("frame-ancestors 'none'");
    expect(cspHttp).not.toContain("upgrade-insecure-requests");

    const cspHttps = buildContentSecurityPolicy({ nonce: "xyz", isDev: true, isHttps: true });
    expect(cspHttps).toContain("'unsafe-eval'");
    expect(cspHttps).toContain("upgrade-insecure-requests");

    expect(sanitizePath("../../etc/passwd\0.png")).toBe("etc/passwd.png");
    expect(sanitizePath("..\\..\\secrets\\.env")).toBe("secrets/.env");
    expect(sanitizePath("/sites/site-a/./covers/../hero.png")).toBe("sites/site-a/covers/hero.png");
  });
});
