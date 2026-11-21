import { describe, it, expect } from "vitest";
import { resolveCanonicalContent, resolveCanonicalBodyText } from "@/lib/content/canonical";
import { extractMermaidDiagrams, renderPostContent } from "@/lib/utils/markdown";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";

describe("Canonical HTML/Markdown separation, Mermaid extraction, and tenant cache keys", () => {
  it("stores sanitized HTML strictly in contentHtml and clears contentMd for HTML entries", () => {
    const htmlPayload = '<p>Rich article body</p><script>alert("xss")</script><img src="https://example.com/a.png" onerror="alert(2)">';
    const canonical = resolveCanonicalContent(htmlPayload, htmlPayload, "html");

    expect(canonical.contentFormat).toBe("html");
    expect(canonical.contentMd).toBe("");
    expect(canonical.contentHtml).toContain("<p>Rich article body</p>");
    expect(canonical.contentHtml).not.toContain("<script");
    expect(canonical.contentHtml).not.toContain("onerror");
  });

  it("auto-detects legacy HTML inside contentMd and migrates it cleanly to contentHtml", () => {
    const legacy = "<p>Legacy <strong>HTML</strong> payload</p><script>bad()</script>";
    const canonical = resolveCanonicalContent(legacy, "");

    expect(canonical.contentFormat).toBe("html");
    expect(canonical.contentMd).toBe("");
    expect(canonical.contentHtml).toContain("<p>Legacy <strong>HTML</strong> payload</p>");
    expect(canonical.contentHtml).not.toContain("<script");
  });

  it("preserves clean Markdown in contentMd when contentFormat is markdown", () => {
    const md = "# Heading\n\nSome **markdown** text.";
    const canonical = resolveCanonicalContent(md, "<script>bad()</script><p>Rendered</p>", "markdown");

    expect(canonical.contentFormat).toBe("markdown");
    expect(canonical.contentMd).toBe(md);
    expect(canonical.contentHtml).toBe("<p>Rendered</p>");
  });

  it("extracts Mermaid diagrams from both fenced Markdown and TipTap HTML blocks without duplicates", () => {
    const md = "Intro\n\n```mermaid\ngraph TD\n  A-->B\n```\n";
    const html =
      '<pre><code class="language-mermaid">graph LR\n  X--&gt;Y</code></pre>' +
      '<p>```mermaid<br>graph TD<br>  A--&gt;B```</p>' +
      '<p>```mermaid<br>sequenceDiagram<br>  Alice-&gt;&gt;Bob: Hello```</p>';

    const diagrams = extractMermaidDiagrams(md, html);
    expect(diagrams).toHaveLength(3);
    expect(diagrams[0]).toBe("graph TD\n  A-->B");
    expect(diagrams[1]).toBe("graph LR\n  X-->Y");
    expect(diagrams[2]).toBe("sequenceDiagram\n  Alice->>Bob: Hello");

    const renderedHtml = renderPostContent(html, { format: "html" });
    expect(renderedHtml).not.toContain("language-mermaid");
    expect(renderedHtml).not.toContain("sequenceDiagram");
  });

  it("builds isolated per-tenant cache tags and falls back safely outside Next runtime", async () => {
    expect(sitePostsCacheTag("site-a")).toBe("site:site-a:posts");
    expect(sitePostsCacheTag("site-b")).toBe("site:site-b:posts");

    const value = await runWithTenantCache(async () => ({ count: 42 }), ["test", "site-a"], {
      tags: [sitePostsCacheTag("site-a")],
      revalidate: 60,
    });
    expect(value).toEqual({ count: 42 });
  });

  it("populates unified canonical content field and falls back to legacy columns cleanly", () => {
    const fromCanonicalHtml = resolveCanonicalContent("", "", "html", "<p>Unified HTML</p><script>bad()</script>");
    expect(fromCanonicalHtml.contentFormat).toBe("html");
    expect(fromCanonicalHtml.content).toBe("<p>Unified HTML</p>");
    expect(fromCanonicalHtml.contentHtml).toBe("<p>Unified HTML</p>");
    expect(fromCanonicalHtml.contentMd).toBe("");

    const fromMarkdown = resolveCanonicalContent("# Title", "", "markdown");
    expect(fromMarkdown.contentFormat).toBe("markdown");
    expect(fromMarkdown.content).toBe("# Title");
    expect(fromMarkdown.contentMd).toBe("# Title");

    expect(
      resolveCanonicalBodyText({
        content: "<p>Canonical wins</p>",
        contentHtml: "<p>Legacy HTML</p>",
        contentMd: "Legacy MD",
        contentFormat: "html",
      })
    ).toBe("<p>Canonical wins</p>");

    expect(
      resolveCanonicalBodyText({
        content: "",
        contentHtml: "<p>Fallback HTML</p>",
        contentMd: "",
        contentFormat: "html",
      })
    ).toBe("<p>Fallback HTML</p>");

    expect(
      resolveCanonicalBodyText({
        content: null,
        contentHtml: "",
        contentMd: "## Fallback MD",
        contentFormat: "markdown",
      })
    ).toBe("## Fallback MD");
  });
});
