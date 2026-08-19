import { parseEmbedUrl } from "./embeds";

/**
 * Universal content parser that converts raw markdown or rich-text HTML into sanitized, embed-resolved HTML for blog posts.
 * Automatically delegates to appropriate HTML embed or Markdown rendering pipelines.
 *
 * @param rawContent - The post body content, either as HTML markup or raw Markdown.
 * @returns Fully rendered and sanitized HTML string with embedded media components.
 */
export function renderPostContent(rawContent: string): string {
  if (!rawContent) return "";

  const trimmed = rawContent.trim();

  if (trimmed.startsWith("<") && (trimmed.startsWith("<p>") || trimmed.startsWith("<h") || trimmed.startsWith("<div") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol"))) {
    return processHtmlEmbeds(trimmed);
  }

  return renderMarkdownToHtml(trimmed);
}

/**
 * Processes pre-rendered HTML strings to resolve embed directives and standalone media URLs into responsive widgets.
 *
 * @param html - Raw HTML markup containing embed directives or standalone media URLs.
 * @returns HTML string with embed directives replaced by responsive iframe/widget markup.
 */
function processHtmlEmbeds(html: string): string {
  let result = html.replace(/<p>\s*@\[(youtube|vimeo|twitter|x|bluesky|video|embed)\]\(([^)]+)\)\s*<\/p>/gi, (_m, _type, url) => {
    const embed = parseEmbedUrl(url.trim());
    return embed ? embed.html : `<p><a href="${url}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${url}</a></p>`;
  });

  result = result.replace(/@\[(youtube|vimeo|twitter|x|bluesky|video|embed)\]\(([^)]+)\)/gi, (_m, _type, url) => {
    const embed = parseEmbedUrl(url.trim());
    return embed ? embed.html : `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${url}</a>`;
  });

  result = result.replace(/<p>\s*(?:<a[^>]*href=["']([^"']+)["'][^>]*>.*?<\/a>|(https?:\/\/[^\s<]+))\s*<\/p>/gi, (match, linkHref, plainUrl) => {
    const targetUrl = linkHref || plainUrl;
    if (targetUrl) {
      const embed = parseEmbedUrl(targetUrl.trim());
      if (embed) {
        return embed.html;
      }
    }
    return match;
  });

  return result;
}

/**
 * Lightweight, zero-dependency Markdown compiler that converts markdown syntax into semantic HTML.
 * Isolates code blocks, Mermaid diagrams, and media embeds while parsing block and inline structures.
 *
 * @param markdown - Raw markdown formatted document string.
 * @returns Semantic HTML string representing the compiled document.
 */
export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";

  let src = markdown.replace(/```mermaid\s*[\s\S]*?```/g, "").trim();

  const codeBlocks: string[] = [];
  src = src.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtml(code.trim());
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(
      `<pre class="bg-surface-hover border border-border p-4 rounded-xl overflow-x-auto my-4 font-mono text-xs"><code class="language-${lang}">${escaped}</code></pre>`
    );
    return placeholder;
  });

  const inlineCodes: string[] = [];
  src = src.replace(/`([^`]+)`/g, (_m, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(
      `<code class="font-mono bg-surface-hover text-accent px-1.5 py-0.5 rounded text-[13px] border border-border">${escapeHtml(code)}</code>`
    );
    return placeholder;
  });

  const embedBlocks: string[] = [];
  src = src.replace(/@\[(youtube|vimeo|twitter|x|bluesky|video|embed)\]\(([^)]+)\)/gi, (_m, _type, url) => {
    const embed = parseEmbedUrl(url.trim());
    if (embed) {
      const placeholder = `__EMBED_BLOCK_${embedBlocks.length}__`;
      embedBlocks.push(embed.html);
      return placeholder;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${url}</a>`;
  });

  const lines = src.split(/\r?\n/);
  const output: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inBlockquote = false;
  let blockquoteBuffer: string[] = [];

  function flushList(): void {
    if (inList) {
      output.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  }

  function flushBlockquote(): void {
    if (inBlockquote) {
      const content = blockquoteBuffer.map(processInline).join("<br />");
      output.push(`<blockquote class="border-l-4 border-accent pl-4 py-1 text-text-muted my-4 italic bg-surface-hover/30 rounded-r-lg">${content}</blockquote>`);
      inBlockquote = false;
      blockquoteBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushBlockquote();
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushList();
      inBlockquote = true;
      blockquoteBuffer.push(trimmed.replace(/^>\s*/, ""));
      continue;
    } else {
      flushBlockquote();
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2]);
      output.push(`<h${level} class="font-bold tracking-tight my-4 text-text">${text}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      output.push('<hr class="border-border my-6" />');
      continue;
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inList !== "ul") {
        flushList();
        output.push('<ul class="list-disc pl-6 my-4 space-y-1">');
        inList = "ul";
      }
      output.push(`<li>${processInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== "ol") {
        flushList();
        output.push('<ol class="list-decimal pl-6 my-4 space-y-1">');
        inList = "ol";
      }
      output.push(`<li>${processInline(olMatch[2])}</li>`);
      continue;
    }

    flushList();

    if (trimmed.startsWith("__CODE_BLOCK_") || trimmed.startsWith("__EMBED_BLOCK_")) {
      output.push(trimmed);
      continue;
    }

    if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
      const autoEmbed = parseEmbedUrl(trimmed);
      if (autoEmbed) {
        output.push(autoEmbed.html);
        continue;
      }
    }

    output.push(`<p class="my-3 text-text leading-relaxed">${processInline(trimmed)}</p>`);
  }

  flushList();
  flushBlockquote();

  let html = output.join("\n");

  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });
  embedBlocks.forEach((block, idx) => {
    html = html.replace(`__EMBED_BLOCK_${idx}__`, block);
  });
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`__INLINE_CODE_${idx}__`, code);
  });

  return html;
}

/**
 * Parses inline formatting syntax (bold, italic, strikethrough, images, links) within a line of text.
 *
 * @param text - Single line of unparsed text.
 * @returns HTML string with inline elements rendered.
 */
function processInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl border border-border shadow-xs my-4 max-w-full" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-text">$1</strong>')
    .replace(/__(.*?)__/g, '<strong class="font-bold text-text">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/_(.*?)_/g, '<em class="italic">$1</em>')
    .replace(/~~(.*?)~~/g, '<del class="line-through opacity-70">$1</del>');
}

/**
 * Escapes unsafe HTML characters to prevent XSS injection in code blocks.
 *
 * @param str - Unescaped raw string.
 * @returns HTML-safe escaped string entity.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
