import { BskyAgent, RichText } from "@atproto/api";
import { getDb } from "@/lib/db";
import { settings, sites, postTags, tags } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getLocalizedText } from "@/lib/utils/localization";
import { normalizeMediaUrl } from "@/lib/storage";

/**
 * Configuration credentials and endpoint options for connecting to Bluesky.
 */
export interface BlueskyCredentials {
  /** Bluesky handle or email (e.g., 'username.bsky.social' or custom domain). */
  identifier: string;
  /** Bluesky App Password (e.g. 'xxxx-xxxx-xxxx-xxxx'). */
  appPassword: string;
  /** Optional custom PDS URL (defaults to 'https://bsky.social'). */
  serviceUrl?: string | null;
}

/**
 * Payload parameters representing an article to be published to Bluesky.
 */
export interface BlueskyPostPayload {
  /** Unique database identifier of the article. */
  id: string;
  /** Article title. */
  title: string;
  /** URL slug of the post. */
  slug: string;
  /** Brief article summary or excerpt. */
  excerpt?: string | null;
  /** Hero or cover image URL. */
  coverImage?: string | null;
  /** Publication timestamp. */
  publishedAt?: Date | null;
  /** Localization language code. */
  locale?: string;
  /** Pre-generated short link from Dub.co if configured. */
  shortUrl?: string | null;
  /** Associated tag IDs to resolve into hashtags. */
  tagIds?: string[];
}

/**
 * Verifies Bluesky credentials by establishing an authenticated session with the target PDS.
 *
 * @param {BlueskyCredentials} creds - Bluesky credentials including handle/email and App Password.
 * @returns {Promise<{ success: boolean; profile?: { handle: string; displayName?: string; avatar?: string }; error?: string }>} Result object with profile metadata on success or descriptive error message.
 */
export async function testBlueskyConnection(creds: BlueskyCredentials): Promise<{
  success: boolean;
  profile?: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  error?: string;
}> {
  const identifier = creds.identifier?.trim();
  const password = creds.appPassword?.trim();
  const service = creds.serviceUrl?.trim() || "https://bsky.social";

  if (!identifier || !password) {
    return {
      success: false,
      error: "Identifier (handle/email) and App Password are required.",
    };
  }

  try {
    const agent = new BskyAgent({ service });
    const sessionRes = await agent.login({
      identifier,
      password,
    });

    if (!sessionRes.success) {
      return {
        success: false,
        error: "Failed to authenticate with Bluesky. Please verify your handle and App Password.",
      };
    }

    const profileRes = await agent.getProfile({ actor: sessionRes.data.did });
    return {
      success: true,
      profile: {
        handle: profileRes.data.handle,
        displayName: profileRes.data.displayName,
        avatar: profileRes.data.avatar,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error connecting to Bluesky AT Protocol service.";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Dispatches an automated post with rich link embed card and hashtags to Bluesky when an article is published.
 * Executes safely in a non-blocking background context.
 *
 * @param {string} siteId - Unique database identifier of the blog site.
 * @param {BlueskyPostPayload} post - Published post data payload.
 * @returns {Promise<boolean>} Promise resolving to true if published successfully, false otherwise.
 */
export async function sendBlueskyPostNotification(
  siteId: string,
  post: BlueskyPostPayload
): Promise<boolean> {
  try {
    const db = getDb();
    const siteSettings = db
      .select()
      .from(settings)
      .where(eq(settings.siteId, siteId))
      .all();

    const configMap: Record<string, string> = {};
    for (const s of siteSettings) {
      configMap[s.key] = s.value;
    }

    const enabled = configMap.bluesky_enabled === "true";
    const identifier = configMap.bluesky_identifier?.trim();
    const appPassword = configMap.bluesky_app_password?.trim();
    const serviceUrl = configMap.bluesky_service_url?.trim() || "https://bsky.social";
    const includeTags = configMap.bluesky_include_tags !== "false";

    if (!enabled || !identifier || !appPassword) {
      return false;
    }

    const agent = new BskyAgent({ service: serviceUrl });
    await agent.login({
      identifier,
      password: appPassword,
    });

    const site = db.select().from(sites).where(eq(sites.id, siteId)).get();
    const postLocale = post.locale || site?.locale || "en";
    const siteDomain = site?.domain || "localhost:3000";
    const baseUrl = siteDomain.includes("localhost")
      ? `http://${siteDomain}`
      : `https://${siteDomain}`;

    const canonicalPostUrl = `${baseUrl}/${postLocale}/entry/${post.slug}`;
    const postUrl = post.shortUrl || canonicalPostUrl;

    // Fetch tags if not passed
    let tagNames: string[] = [];
    if (includeTags) {
      if (post.tagIds && post.tagIds.length > 0) {
        const dbTags = db
          .select({ name: tags.name })
          .from(tags)
          .where(and(eq(tags.siteId, siteId), inArray(tags.id, post.tagIds)))
          .all();
        tagNames = dbTags.map((t) => t.name);
      } else {
        const postTagRows = db
          .select({ name: tags.name })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(eq(postTags.postId, post.id))
          .all();
        tagNames = postTagRows.map((t) => t.name);
      }
    }

    const hashtags = tagNames
      .map((name) => `#${name.replace(/[^a-zA-Z0-9_\u0080-\uFFFF]/g, "")}`)
      .filter((h) => h.length > 1)
      .slice(0, 5)
      .join(" ");

    // Compose text respecting Bluesky's 300 grapheme limit
    const title = post.title.trim();
    const excerpt = (post.excerpt || "").trim();

    let postText = `📢 ${title}`;
    if (excerpt) {
      const remainingForExcerpt = 260 - postText.length - (hashtags ? hashtags.length + 2 : 0);
      if (remainingForExcerpt > 20) {
        const truncatedExcerpt =
          excerpt.length > remainingForExcerpt
            ? `${excerpt.slice(0, remainingForExcerpt - 3)}…`
            : excerpt;
        postText += `\n\n${truncatedExcerpt}`;
      }
    }

    if (hashtags) {
      postText += `\n\n${hashtags}`;
    }

    const rt = new RichText({ text: postText });
    await rt.detectFacets(agent);

    // Build external embed link card with optional cover thumbnail
    let embed: any = undefined;
    let thumbBlob: any = undefined;

    if (post.coverImage) {
      try {
        const cleanCover = normalizeMediaUrl(post.coverImage);
        const coverImageUrl = cleanCover.startsWith("http")
          ? cleanCover
          : `${baseUrl}${cleanCover.startsWith("/") ? "" : "/"}${cleanCover}`;

        const imgRes = await fetch(coverImageUrl);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          // Ensure image buffer is under 1MB for Bluesky thumbnail blob limits
          if (imgBuffer.length > 0 && imgBuffer.length < 1000000) {
            const uploadRes = await agent.uploadBlob(imgBuffer, { encoding: contentType });
            thumbBlob = uploadRes.data.blob;
          }
        }
      } catch {
        // Continue creating embed without thumbnail if image fetch fails
      }
    }

    embed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: postUrl,
        title: post.title,
        description: post.excerpt?.slice(0, 300) || "",
        thumb: thumbBlob,
      },
    };

    await agent.post({
      text: rt.text,
      facets: rt.facets,
      embed,
      createdAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Error posting to Bluesky:", error);
    return false;
  }
}
