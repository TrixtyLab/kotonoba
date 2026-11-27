import sanitizeHtml from "sanitize-html";

export { sanitizeUrl, sanitizeNavLinksJson } from "./urls";

/**
 * Hostnames allowed to be framed inside stored content.
 *
 * Every embed provider supported by the editor is listed here; anything else
 * is removed so an author cannot frame an arbitrary external page.
 */
const ALLOWED_IFRAME_HOSTNAMES = [
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "store.steampowered.com",
  "itch.io",
  "open.spotify.com",
  "platform.twitter.com",
  "embed.bsky.app",
];

/**
 * Structural and editorial tags permitted in post and page bodies.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "small",
  "sub",
  "sup",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "iframe",
  "video",
  "audio",
  "source",
];

/**
 * Sanitizes rich-text HTML before it is persisted or injected into the DOM.
 *
 * Removes scripts, event handlers, inline styles, dangerous URL schemes and
 * untrusted iframes while preserving the markup produced by the editor and the
 * embed renderer. Links are forced to open safely and images load lazily.
 *
 * @param html - Untrusted HTML from the editor, API client or legacy database rows.
 * @returns HTML safe to pass to `dangerouslySetInnerHTML`.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      iframe: [
        "src",
        "title",
        "allow",
        "allowfullscreen",
        "frameborder",
        "loading",
        "referrerpolicy",
      ],
      video: ["src", "controls", "poster", "width", "height", "preload", "muted", "loop", "playsinline"],
      audio: ["src", "controls", "preload", "loop"],
      source: ["src", "type", "media"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer nofollow" }
              : { rel: "noopener noreferrer" }),
          },
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || "lazy",
          decoding: attribs.decoding || "async",
        },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || "lazy",
          referrerpolicy: attribs.referrerpolicy || "strict-origin-when-cross-origin",
        },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
  });
}

/**
 * Escapes a value for safe inclusion in an HTML attribute or text node.
 *
 * @param value - Raw value.
 * @returns Escaped string.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INLINE_ALLOWED_TAGS = [
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "small",
  "sub",
  "sup",
  "code",
  "a",
  "br",
];

/**
 * Sanitizes inline HTML snippets such as captions or summaries, stripping all block
 * elements, embedded media, scripts, and unsafe link protocols.
 *
 * @param html - Untrusted HTML string.
 * @returns Sanitized inline HTML string.
 */
export function sanitizeInlineHtml(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: INLINE_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer nofollow" }
              : { rel: "noopener noreferrer" }),
          },
        };
      },
    },
  });
}

/**
 * Sanitizes tenant `customCss` strings by stripping HTML tags and hazardous CSS constructs
 * such as `@import`, `expression(...)`, external `url(...)` exfiltration vectors, or legacy script behaviors.
 *
 * @param css - Untrusted CSS input.
 * @returns Hardened CSS string safe to persist in tenant configuration.
 */
export function sanitizeCss(css: string | null | undefined): string {
  if (!css || typeof css !== "string") return "";

  return css
    .replace(/[<>]/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import\b[^;]*;?/gi, "")
    .replace(/@charset\b[^;]*;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/(?:javascript|vbscript|data)\s*:/gi, "")
    .replace(/behavior\s*:[^;]*;?/gi, "")
    .replace(/-moz-binding\s*:[^;]*;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(/gi, "")
    .trim();
}
