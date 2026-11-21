import { escapeHtml } from "@/lib/security/sanitize";
import { sanitizeUrl } from "@/lib/security/urls";

/**
 * Metadata and rendered HTML markup for an external embedded media asset.
 */
export interface EmbedInfo {
  /** The identified provider type of the embedded media. */
  type: "youtube" | "vimeo" | "twitter" | "bluesky" | "steam" | "itch" | "video";
  /** Responsive HTML markup ready for DOM injection. */
  html: string;
}

/**
 * Parses and extracts the 11-character video ID from a YouTube video or Shorts URL.
 *
 * @param {string} url - The YouTube URL string to parse.
 * @returns {string | null} The extracted YouTube video ID, or null if the URL is not recognized as a YouTube link.
 */
function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

/**
 * Parses and extracts the numeric video ID from a Vimeo URL.
 *
 * @param {string} url - The Vimeo URL string to parse.
 * @returns {string | null} The extracted Vimeo video ID string, or null if not a valid Vimeo link.
 */
function extractVimeoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+))/i);
  return match ? match[1] : null;
}

/**
 * Extracts the user handle and status ID from an X (formerly Twitter) post URL.
 *
 * @param {string} url - The X/Twitter URL string to parse.
 * @returns {{ username: string; tweetId: string } | null} An object with the username and tweetId, or null if invalid.
 */
function extractTwitterInfo(url: string): { username: string; tweetId: string } | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
  if (!match) return null;
  return { username: match[1], tweetId: match[2] };
}

/**
 * Extracts the author handle and post ID from a Bluesky post URL.
 *
 * @param {string} url - The Bluesky URL string to parse.
 * @returns {{ handle: string; postId: string } | null} An object containing handle and postId, or null if invalid.
 */
function extractBlueskyInfo(url: string): { handle: string; postId: string } | null {
  const match = url.match(/bsky\.app\/profile\/([a-zA-Z0-9_.:-]+)\/post\/([a-zA-Z0-9]+)/i);
  if (!match) return null;
  return { handle: match[1], postId: match[2] };
}

/**
 * Parses and extracts the numeric App ID from a Steam store URL, widget iframe, or prefixed ID.
 *
 * @param {string} input - The Steam URL, widget snippet, or prefixed ID string (e.g. 'steam:1299800').
 * @returns {string | null} The extracted Steam App ID string, or null if invalid.
 */
export function extractSteamId(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;
  const prefixMatch = clean.match(/^steam[:/ -](\d+)$/i);
  if (prefixMatch) {
    return prefixMatch[1];
  }
  const match = clean.match(/(?:store\.steampowered\.com\/(?:app|widget)\/|steam:\/\/app\/)(\d+)/i);
  if (match) return match[1];

  const htmlMatch = clean.match(/src=["']https?:\/\/store\.steampowered\.com\/widget\/(\d+)[^"']*["']/i);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

/**
 * Parses and extracts the game ID from an itch.io embed URL, widget snippet, or prefixed ID.
 *
 * @param {string} input - The itch.io embed URL, iframe snippet, or prefixed ID string (e.g. 'itch:2548291').
 * @returns {string | null} The extracted itch.io game ID string, or null if invalid.
 */
export function extractItchId(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;
  const prefixMatch = clean.match(/^(?:itch|itchio)[:/ -](\d+)$/i);
  if (prefixMatch) {
    return prefixMatch[1];
  }
  const embedMatch = clean.match(/itch\.io\/embed(?:-upload)?\/(\d+)/i);
  if (embedMatch) return embedMatch[1];

  const htmlMatch = clean.match(/src=["']https?:\/\/itch\.io\/embed(?:-upload)?\/(\d+)[^"']*["']/i);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

/**
 * Options for configuring tracking UTM parameters on embedded widgets.
 */
export interface EmbedOptions {
  /** UTM source parameter value (defaults to 'myblog'). */
  utmSource?: string;
  /** UTM medium parameter value (defaults to 'widget'). */
  utmMedium?: string;
  /** UTM campaign parameter value (defaults to 'article_embed'). */
  utmCampaign?: string;
}

function buildUtmQuery(options?: EmbedOptions): string {
  const src = encodeURIComponent(options?.utmSource || "myblog");
  const med = encodeURIComponent(options?.utmMedium || "widget");
  const camp = encodeURIComponent(options?.utmCampaign || "article_embed");
  return `utm_source=${src}&utm_medium=${med}&utm_campaign=${camp}`;
}

function buildSteamEmbed(steamId: string, options?: EmbedOptions): EmbedInfo {
  const steamSrc = `https://store.steampowered.com/widget/${steamId}/?${buildUtmQuery(options)}`;
  return {
    type: "steam",
    html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${steamSrc}" frameborder="0" class="w-full border-0 h-[190px] block" loading="lazy" title="Steam Widget ${steamId}"></iframe>
</div>`,
  };
}

function buildItchEmbed(itchId: string, options?: EmbedOptions): EmbedInfo {
  const itchSrc = `https://itch.io/embed/${itchId}?dark=true&${buildUtmQuery(options)}`;
  return {
    type: "itch",
    html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${itchSrc}" frameborder="0" class="w-full border-0 h-[167px] sm:h-[175px] block" loading="lazy" title="itch.io Widget ${itchId}"></iframe>
</div>`,
  };
}

function buildYoutubeEmbed(ytId: string): EmbedInfo {
  return {
    type: "youtube",
    html: `<div class="my-6 rounded-2xl overflow-hidden w-full aspect-video">
  <iframe src="https://www.youtube-nocookie.com/embed/${ytId}" title="YouTube video player" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
</div>`,
  };
}

function buildVimeoEmbed(vimeoId: string): EmbedInfo {
  return {
    type: "vimeo",
    html: `<div class="my-6 rounded-2xl overflow-hidden w-full aspect-video">
  <iframe src="https://player.vimeo.com/video/${vimeoId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>`,
  };
}

function buildTwitterEmbed(tweet: { username: string; tweetId: string }): EmbedInfo {
  return {
    type: "twitter",
    html: `<div class="my-6 w-full">
  <blockquote class="twitter-tweet" data-dnt="true">
    <a href="https://x.com/${tweet.username}/status/${tweet.tweetId}">Ver publicación en X (@${tweet.username})</a>
  </blockquote>
</div>`,
  };
}

function buildBlueskyEmbed(bsky: { handle: string; postId: string }): EmbedInfo {
  return {
    type: "bluesky",
    html: `<div class="my-6 w-full">
  <blockquote class="bluesky-embed" data-bluesky-uri="at://${bsky.handle}/app.bsky.feed.post/${bsky.postId}">
    <a href="https://bsky.app/profile/${bsky.handle}/post/${bsky.postId}" target="_blank" rel="noopener noreferrer">Ver publicación en Bluesky (@${bsky.handle})</a>
  </blockquote>
</div>`,
  };
}

function buildVideoEmbed(url: string): EmbedInfo | null {
  const safeVideoUrl = sanitizeUrl(url, { allowRelative: true });
  if (!safeVideoUrl) return null;
  return {
    type: "video",
    html: `<div class="my-6 rounded-2xl overflow-hidden w-full flex items-center justify-center aspect-video">
  <video src="${escapeHtml(safeVideoUrl)}" controls class="w-full h-full object-contain"></video>
</div>`,
  };
}

function extractDirectiveTarget(clean: string): string {
  const iframeSrcMatch = clean.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (iframeSrcMatch) return iframeSrcMatch[1];
  const linkHrefMatch = clean.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (linkHrefMatch) return linkHrefMatch[1];
  return clean.replace(/<[^>]+>/g, "").trim();
}

const DIRECTIVE_HANDLERS: Record<
  string,
  (effectiveTarget: string, clean: string, options?: EmbedOptions) => EmbedInfo | null
> = {
  steam: (eff, clean, opt) => {
    const id = extractSteamId(eff) || extractSteamId(clean) || eff.replace(/\D/g, "");
    return id ? buildSteamEmbed(id, opt) : null;
  },
  itch: (eff, clean, opt) => {
    const id = extractItchId(eff) || extractItchId(clean) || eff.replace(/\D/g, "");
    return id ? buildItchEmbed(id, opt) : null;
  },
  youtube: (eff, clean) => {
    const id = extractYouTubeId(eff) || extractYouTubeId(clean) || eff;
    return id ? buildYoutubeEmbed(id) : null;
  },
  vimeo: (eff, clean) => {
    const id = extractVimeoId(eff) || extractVimeoId(clean) || eff;
    return id ? buildVimeoEmbed(id) : null;
  },
  twitter: (eff, clean) => {
    const tweet = extractTwitterInfo(eff) || extractTwitterInfo(clean);
    return tweet ? buildTwitterEmbed(tweet) : null;
  },
  bluesky: (eff, clean) => {
    const bsky = extractBlueskyInfo(eff) || extractBlueskyInfo(clean);
    return bsky ? buildBlueskyEmbed(bsky) : null;
  },
  video: (eff) => buildVideoEmbed(eff),
};
DIRECTIVE_HANDLERS.itchio = DIRECTIVE_HANDLERS.itch;
DIRECTIVE_HANDLERS.x = DIRECTIVE_HANDLERS.twitter;

/**
 * Renders an embed given an explicit provider type and target URL or ID.
 * Eliminates ambiguity between numeric IDs from different platforms (e.g. Steam vs itch.io).
 *
 * @param {string} type - Provider type name ('steam', 'itch', 'youtube', 'vimeo', 'twitter', 'bluesky', 'video').
 * @param {string} target - Platform-specific numeric identifier, embed URL, or snippet.
 * @param {EmbedOptions} [options] - Optional UTM tracking parameters.
 * @returns {EmbedInfo | null} Rendered embed info or null if unrecognized.
 */
export function parseEmbedDirective(type: string, target: string, options?: EmbedOptions): EmbedInfo | null {
  const clean = target.trim();
  if (!clean) return null;

  const effectiveTarget = extractDirectiveTarget(clean);
  const handler = DIRECTIVE_HANDLERS[type.toLowerCase().trim()];
  if (handler) {
    const matched = handler(effectiveTarget, clean, options);
    if (matched) return matched;
  }

  return parseEmbedUrl(effectiveTarget, options);
}

/**
 * Analyzes an arbitrary URL or identifier and generates a responsive HTML embed widget if supported.
 * Supports Steam Widgets, itch.io Widgets, YouTube, Vimeo, X (Twitter), Bluesky, and direct video files.
 *
 * @param {string} rawUrl - The target URL, iframe, or identifier to evaluate for embedding.
 * @param {EmbedOptions} [options] - Optional UTM tracking parameters applied to store widgets.
 * @returns {EmbedInfo | null} An EmbedInfo object with provider type and HTML markup, or null if unsupported.
 */
export function parseEmbedUrl(rawUrl: string, options?: EmbedOptions): EmbedInfo | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const steamId = extractSteamId(url);
  if (steamId) return buildSteamEmbed(steamId, options);
  const itchId = extractItchId(url);
  if (itchId) return buildItchEmbed(itchId, options);
  const ytId = extractYouTubeId(url);
  if (ytId) return buildYoutubeEmbed(ytId);
  const vimeoId = extractVimeoId(url);
  if (vimeoId) return buildVimeoEmbed(vimeoId);
  const tweet = extractTwitterInfo(url);
  if (tweet) return buildTwitterEmbed(tweet);
  const bsky = extractBlueskyInfo(url);
  if (bsky) return buildBlueskyEmbed(bsky);
  if (/\.(mp4|webm|ogg|mov)($|\?)/i.test(url)) return buildVideoEmbed(url);
  return null;
}
