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
export function extractYouTubeId(url: string): string | null {
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
export function extractVimeoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+))/i);
  return match ? match[1] : null;
}

/**
 * Extracts the user handle and status ID from an X (formerly Twitter) post URL.
 *
 * @param {string} url - The X/Twitter URL string to parse.
 * @returns {{ username: string; tweetId: string } | null} An object with the username and tweetId, or null if invalid.
 */
export function extractTwitterInfo(url: string): { username: string; tweetId: string } | null {
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
export function extractBlueskyInfo(url: string): { handle: string; postId: string } | null {
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

  const linkHrefMatch = clean.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
  const iframeSrcMatch = clean.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  const effectiveTarget = iframeSrcMatch ? iframeSrcMatch[1] : (linkHrefMatch ? linkHrefMatch[1] : clean.replace(/<[^>]+>/g, "").trim());

  const provider = type.toLowerCase().trim();
  const utmSource = options?.utmSource || "myblog";
  const utmMedium = options?.utmMedium || "widget";
  const utmCampaign = options?.utmCampaign || "article_embed";

  if (provider === "steam") {
    const steamId = extractSteamId(effectiveTarget) || extractSteamId(clean) || effectiveTarget.replace(/\D/g, "");
    if (steamId) {
      const steamSrc = `https://store.steampowered.com/widget/${steamId}/?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
      return {
        type: "steam",
        html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${steamSrc}" frameborder="0" class="w-full border-0 h-[190px] block" loading="lazy" title="Steam Widget ${steamId}"></iframe>
</div>`,
      };
    }
  }

  if (provider === "itch" || provider === "itchio") {
    const itchId = extractItchId(effectiveTarget) || extractItchId(clean) || effectiveTarget.replace(/\D/g, "");
    if (itchId) {
      const itchSrc = `https://itch.io/embed/${itchId}?dark=true&utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
      return {
        type: "itch",
        html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${itchSrc}" frameborder="0" class="w-full border-0 h-[167px] sm:h-[175px] block" loading="lazy" title="itch.io Widget ${itchId}"></iframe>
</div>`,
      };
    }
  }

  if (provider === "youtube") {
    const ytId = extractYouTubeId(effectiveTarget) || extractYouTubeId(clean) || effectiveTarget;
    if (ytId) {
      return {
        type: "youtube",
        html: `<div class="my-6 rounded-2xl overflow-hidden w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://www.youtube-nocookie.com/embed/${ytId}" title="YouTube video player" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
</div>`,
      };
    }
  }

  if (provider === "vimeo") {
    const vimeoId = extractVimeoId(effectiveTarget) || extractVimeoId(clean) || effectiveTarget;
    if (vimeoId) {
      return {
        type: "vimeo",
        html: `<div class="my-6 rounded-2xl overflow-hidden w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://player.vimeo.com/video/${vimeoId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>`,
      };
    }
  }

  if (provider === "twitter" || provider === "x") {
    const tweet = extractTwitterInfo(effectiveTarget) || extractTwitterInfo(clean);
    if (tweet) {
      return {
        type: "twitter",
        html: `<div class="my-6 w-full">
  <blockquote class="twitter-tweet" data-dnt="true">
    <a href="https://x.com/${tweet.username}/status/${tweet.tweetId}">Ver publicación en X (@${tweet.username})</a>
  </blockquote>
  <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>`,
      };
    }
  }

  if (provider === "bluesky") {
    const bsky = extractBlueskyInfo(effectiveTarget) || extractBlueskyInfo(clean);
    if (bsky) {
      return {
        type: "bluesky",
        html: `<div class="my-6 w-full">
  <blockquote class="bluesky-embed" data-bluesky-uri="at://${bsky.handle}/app.bsky.feed.post/${bsky.postId}">
    <a href="https://bsky.app/profile/${bsky.handle}/post/${bsky.postId}" target="_blank" rel="noopener noreferrer">Ver publicación en Bluesky (@${bsky.handle})</a>
  </blockquote>
  <script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
</div>`,
      };
    }
  }

  if (provider === "video") {
    return {
      type: "video",
      html: `<div class="my-6 rounded-2xl overflow-hidden w-full flex items-center justify-center" style="aspect-ratio: 16 / 9;">
  <video src="${effectiveTarget}" controls class="w-full h-full object-contain"></video>
</div>`,
    };
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

  const utmSource = options?.utmSource || "myblog";
  const utmMedium = options?.utmMedium || "widget";
  const utmCampaign = options?.utmCampaign || "article_embed";

  const steamId = extractSteamId(url);
  if (steamId) {
    const steamSrc = `https://store.steampowered.com/widget/${steamId}/?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
    return {
      type: "steam",
      html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${steamSrc}" frameborder="0" class="w-full border-0 h-[190px] block" loading="lazy" title="Steam Widget ${steamId}"></iframe>
</div>`,
    };
  }

  const itchId = extractItchId(url);
  if (itchId) {
    const itchSrc = `https://itch.io/embed/${itchId}?dark=true&utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;
    return {
      type: "itch",
      html: `<div class="my-6 w-full rounded-xl overflow-hidden">
  <iframe src="${itchSrc}" frameborder="0" class="w-full border-0 h-[167px] sm:h-[175px] block" loading="lazy" title="itch.io Widget ${itchId}"></iframe>
</div>`,
    };
  }

  const ytId = extractYouTubeId(url);
  if (ytId) {
    return {
      type: "youtube",
      html: `<div class="my-6 rounded-2xl overflow-hidden w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://www.youtube-nocookie.com/embed/${ytId}" title="YouTube video player" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
</div>`,
    };
  }

  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      type: "vimeo",
      html: `<div class="my-6 rounded-2xl overflow-hidden w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://player.vimeo.com/video/${vimeoId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>`,
    };
  }

  const tweet = extractTwitterInfo(url);
  if (tweet) {
    return {
      type: "twitter",
      html: `<div class="my-6 w-full">
  <blockquote class="twitter-tweet" data-dnt="true">
    <a href="https://x.com/${tweet.username}/status/${tweet.tweetId}">Ver publicación en X (@${tweet.username})</a>
  </blockquote>
  <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>`,
    };
  }

  const bsky = extractBlueskyInfo(url);
  if (bsky) {
    return {
      type: "bluesky",
      html: `<div class="my-6 w-full">
  <blockquote class="bluesky-embed" data-bluesky-uri="at://${bsky.handle}/app.bsky.feed.post/${bsky.postId}">
    <a href="https://bsky.app/profile/${bsky.handle}/post/${bsky.postId}" target="_blank" rel="noopener noreferrer">Ver publicación en Bluesky (@${bsky.handle})</a>
  </blockquote>
  <script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
</div>`,
    };
  }

  if (/\.(mp4|webm|ogg|mov)($|\?)/i.test(url)) {
    return {
      type: "video",
      html: `<div class="my-6 rounded-2xl overflow-hidden w-full flex items-center justify-center" style="aspect-ratio: 16 / 9;">
  <video src="${url}" controls class="w-full h-full object-contain"></video>
</div>`,
    };
  }

  return null;
}
