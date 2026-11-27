import { describe, it, expect } from "vitest";
import { sanitizeRichHtml, sanitizeInlineHtml, escapeHtml } from "@/lib/security/sanitize";

describe("sanitizeRichHtml", () => {
  it("strips script tags, event handlers, and dangerous URLs", () => {
    const dirty = [
      '<p>Hello</p>',
      '<script>alert("xss")</script>',
      '<img src="https://example.com/a.png" onerror="alert(1)" />',
      '<a href="javascript:alert(1)">bad</a>',
      '<a href="data:text/html,<script>alert(1)</script>">data</a>',
      '<a href="//evil.example.com">proto-rel</a>',
    ].join("");

    const clean = sanitizeRichHtml(dirty);
    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("data:text/html");
    expect(clean).not.toContain("//evil.example.com");
  });

  it("forces safe target and rel attributes on external links", () => {
    const clean = sanitizeRichHtml('<a href="https://example.com/docs">Docs</a>');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("allows trusted embed iframes and drops arbitrary iframes", () => {
    const allowed = sanitizeRichHtml(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>'
    );
    const blocked = sanitizeRichHtml('<iframe src="https://evil.example.com/phish"></iframe>');

    expect(allowed).toContain("youtube-nocookie.com");
    expect(blocked).not.toContain("<iframe");
    expect(blocked).not.toContain("evil.example.com");
  });

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<a href="x">'&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;");
  });

  it("sanitizes inline snippets while stripping block tags, images, and unsafe protocols", () => {
    const clean = sanitizeInlineHtml(
      '<div><strong>Hello</strong> <img src="x" onerror="alert(1)" /> <a href="javascript:alert(1)">bad</a> <a href="https://kotonoba.dev">good</a></div>'
    );
    expect(clean).toContain("<strong>Hello</strong>");
    expect(clean).not.toContain("<div");
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain("https://kotonoba.dev");
  });
});
