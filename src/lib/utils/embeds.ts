/**
 * Metadata and rendered HTML markup for an external embedded media asset.
 */
export interface EmbedInfo {
  /** The identified provider type of the embedded media. */
  type: "youtube" | "vimeo" | "twitter" | "bluesky" | "video";
  /** Responsive HTML markup ready for DOM injection. */
  html: string;
}

/**
 * Parses and extracts the 11-character video ID from a YouTube video or Shorts URL.
 *
 * @param url - The YouTube URL string to parse.
 * @returns The extracted YouTube video ID, or null if the URL is not recognized as a YouTube link.
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
 * @param url - The Vimeo URL string to parse.
 * @returns The extracted Vimeo video ID string, or null if not a valid Vimeo link.
 */
export function extractVimeoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+))/i);
  return match ? match[1] : null;
}

/**
 * Extracts the user handle and status ID from an X (formerly Twitter) post URL.
 *
 * @param url - The X/Twitter URL string to parse.
 * @returns An object with the username and tweetId, or null if invalid.
 */
export function extractTwitterInfo(url: string): { username: string; tweetId: string } | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i);
  if (!match) return null;
  return { username: match[1], tweetId: match[2] };
}

/**
 * Extracts the author handle and post ID from a Bluesky post URL.
 *
 * @param url - The Bluesky URL string to parse.
 * @returns An object containing handle and postId, or null if invalid.
 */
export function extractBlueskyInfo(url: string): { handle: string; postId: string } | null {
  const match = url.match(/bsky\.app\/profile\/([a-zA-Z0-9_.:-]+)\/post\/([a-zA-Z0-9]+)/i);
  if (!match) return null;
  return { handle: match[1], postId: match[2] };
}

/**
 * Analyzes an arbitrary URL and generates a responsive 16:9 or native HTML embed if supported.
 * Supports YouTube, Vimeo, X (Twitter), Bluesky, and direct MP4/WebM video files.
 *
 * @param rawUrl - The target URL to evaluate for embedding.
 * @returns An EmbedInfo object with the provider type and HTML markup, or null if unsupported.
 */
export function parseEmbedUrl(rawUrl: string): EmbedInfo | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const ytId = extractYouTubeId(url);
  if (ytId) {
    return {
      type: "youtube",
      html: `<div class="my-6 rounded-2xl overflow-hidden border border-border shadow-md bg-black w-full max-w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://www.youtube-nocookie.com/embed/${ytId}" title="YouTube video player" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
</div>`,
    };
  }

  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      type: "vimeo",
      html: `<div class="my-6 rounded-2xl overflow-hidden border border-border shadow-md bg-black w-full max-w-full" style="aspect-ratio: 16 / 9;">
  <iframe src="https://player.vimeo.com/video/${vimeoId}" class="w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</div>`,
    };
  }

  const tweet = extractTwitterInfo(url);
  if (tweet) {
    return {
      type: "twitter",
      html: `<div class="my-6 max-w-lg mx-auto rounded-2xl border border-border p-4 bg-surface shadow-xs">
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
      html: `<div class="my-6 max-w-lg mx-auto rounded-2xl border border-border p-4 bg-surface shadow-xs">
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
      html: `<div class="my-6 rounded-2xl overflow-hidden border border-border shadow-md bg-black w-full max-w-full flex items-center justify-center" style="aspect-ratio: 16 / 9;">
  <video src="${url}" controls class="w-full h-full object-contain"></video>
</div>`,
    };
  }

  return null;
}
