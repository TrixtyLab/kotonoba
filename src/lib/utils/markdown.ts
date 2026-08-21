import { parseEmbedUrl, parseEmbedDirective, type EmbedOptions } from "./embeds";

/**
 * Configuration options for rendering content with custom tracking and UTM parameters.
 */
export interface RenderContentOptions extends EmbedOptions {}

/**
 * Universal content parser that converts raw markdown or rich-text HTML into sanitized, embed-resolved HTML for blog posts.
 * Automatically delegates to appropriate HTML embed or Markdown rendering pipelines.
 *
 * @param {string} rawContent - The post body content, either as HTML markup or raw Markdown.
 * @param {RenderContentOptions} [options] - Optional configuration including UTM parameters for embeds.
 * @returns {string} Fully rendered and sanitized HTML string with embedded media components.
 */
export function renderPostContent(rawContent: string, options?: RenderContentOptions): string {
  if (!rawContent) return "";

  const trimmed = rawContent.trim();

  if (trimmed.startsWith("<") && (trimmed.startsWith("<p>") || trimmed.startsWith("<h") || trimmed.startsWith("<div") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol") || trimmed.startsWith("<iframe"))) {
    return processHtmlEmbeds(trimmed, options);
  }

  return renderMarkdownToHtml(trimmed, options);
}

/**
 * Processes pre-rendered HTML strings to resolve embed directives, raw iframes, and standalone media URLs into responsive widgets.
 *
 * @param {string} html - Raw HTML markup containing embed directives, iframes, or standalone media URLs.
 * @param {RenderContentOptions} [options] - Optional UTM tracking parameters for embeds.
 * @returns {string} HTML string with embed directives replaced by responsive iframe/widget markup.
 */
function processHtmlEmbeds(html: string, options?: RenderContentOptions): string {
  let result = html.replace(/<p>\s*@\[(youtube|vimeo|twitter|x|bluesky|steam|itch|itchio|video|embed)\]\(([^)]+)\)\s*<\/p>/gi, (_m, type, url) => {
    const embed = parseEmbedDirective(type, url.trim(), options);
    return embed ? embed.html : `<p><a href="${url}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${url}</a></p>`;
  });

  result = result.replace(/@\[(youtube|vimeo|twitter|x|bluesky|steam|itch|itchio|video|embed)\]\(([^)]+)\)/gi, (_m, type, url) => {
    const embed = parseEmbedDirective(type, url.trim(), options);
    return embed ? embed.html : `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${url}</a>`;
  });

  result = result.replace(/<p>\s*(<iframe[^>]*src=["']https?:\/\/(?:store\.steampowered\.com\/widget|itch\.io\/embed)[^"']*["'][^>]*>.*?<\/iframe>)\s*<\/p>/gi, (_m, rawIframe) => {
    const embed = parseEmbedUrl(rawIframe, options);
    return embed ? embed.html : rawIframe;
  });

  result = result.replace(/<iframe[^>]*src=["']https?:\/\/(?:store\.steampowered\.com\/widget|itch\.io\/embed)[^"']*["'][^>]*>.*?<\/iframe>/gi, (rawIframe) => {
    const embed = parseEmbedUrl(rawIframe, options);
    return embed ? embed.html : rawIframe;
  });

  result = result.replace(/<p>\s*(?:<a[^>]*href=["']([^"']+)["'][^>]*>.*?<\/a>|(https?:\/\/[^\s<]+))\s*<\/p>/gi, (match, linkHref, plainUrl) => {
    const targetUrl = linkHref || plainUrl;
    if (targetUrl) {
      const embed = parseEmbedUrl(targetUrl.trim(), options);
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
 * @param {string} markdown - Raw markdown formatted document string.
 * @param {RenderContentOptions} [options] - Optional UTM tracking parameters for embeds.
 * @returns {string} Semantic HTML string representing the compiled document.
 */
export function renderMarkdownToHtml(markdown: string, options?: RenderContentOptions): string {
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
  src = src.replace(/<iframe[^>]*src=["']https?:\/\/(?:store\.steampowered\.com\/widget|itch\.io\/embed)[^"']*["'][^>]*>.*?<\/iframe>/gi, (rawIframe) => {
    const embed = parseEmbedUrl(rawIframe, options);
    if (embed) {
      const placeholder = `__EMBED_BLOCK_${embedBlocks.length}__`;
      embedBlocks.push(embed.html);
      return placeholder;
    }
    return rawIframe;
  });

  src = src.replace(/@\[(youtube|vimeo|twitter|x|bluesky|steam|itch|itchio|video|embed)\]\(([^)]+)\)/gi, (_m, type, url) => {
    const embed = parseEmbedDirective(type, url.trim(), options);
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

  function flushList() {
    if (inList) {
      output.push(`</${inList}>`);
      inList = null;
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      const innerHtml = blockquoteBuffer.map((line) => processInline(line)).join("<br />");
      output.push(
        `<blockquote class="border-l-4 border-accent pl-4 py-1.5 my-4 bg-accent/5 rounded-r-lg italic text-text-muted text-sm leading-relaxed">${innerHtml}</blockquote>`
      );
      blockquoteBuffer = [];
      inBlockquote = false;
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
    }

    flushBlockquote();

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
    .replace(/\*(.*?)\*/g, '<em class="italic text-text">$1</em>')
    .replace(/_(.*?)_/g, '<em class="italic text-text">$1</em>')
    .replace(/~~(.*?)~~/g, '<del class="line-through text-text-muted">$1</del>');
}

/**
 * Encodes special HTML entities in code blocks.
 *
 * @param str - Unescaped raw string.
 * @returns HTML-safe escaped string.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
