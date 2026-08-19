"use server";

import { isDubConfigured, createDubLink } from "@/lib/dub";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Checks whether the Dub.co link shortening service is configured in the environment.
 *
 * @returns A Promise resolving to an object containing boolean configuration status.
 */
export async function getDubStatusAction(): Promise<{ isConfigured: boolean }> {
  return { isConfigured: isDubConfigured() };
}

/**
 * Input parameters for creating a short link via Dub.co.
 */
export interface GenerateDubLinkParams {
  /** Optional post database ID to associate the generated link with. */
  postId?: string;
  /** Destination long URL. */
  originalUrl: string;
  /** Optional custom slug identifier for the shortened link. */
  customSlug?: string;
  /** UTM Source parameter value. */
  utmSource?: string;
  /** UTM Medium parameter value. */
  utmMedium?: string;
  /** UTM Campaign parameter value. */
  utmCampaign?: string;
  /** UTM Term keyword parameter value. */
  utmTerm?: string;
  /** UTM Content creative parameter value. */
  utmContent?: string;
}

/**
 * Generates a campaign-tracked short link via Dub.co and optionally associates it with a blog post.
 *
 * @param params - Generation options including destination URL, custom slug, and UTM campaign parameters.
 * @returns A Promise resolving to an object containing the short URL, QR code asset URL, and success flag.
 */
export async function generateDubLinkAction(params: GenerateDubLinkParams): Promise<{
  success: boolean;
  shortUrl?: string;
  qrCodeUrl?: string;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isDubConfigured()) {
    return {
      success: false,
      error: "Dub.co integration is not configured. Set DUB_API_KEY in your environment.",
    };
  }

  const result = await createDubLink({
    url: params.originalUrl,
    slug: params.customSlug,
    utmSource: params.utmSource,
    utmMedium: params.utmMedium,
    utmCampaign: params.utmCampaign,
    utmTerm: params.utmTerm,
    utmContent: params.utmContent,
  });

  if (!result) {
    return { success: false, error: "Failed to generate short link on Dub.co" };
  }

  if (params.postId) {
    try {
      const db = getDb();
      db.update(posts)
        .set({
          shortUrl: result.shortUrl,
          dubLinkId: result.id,
        })
        .where(eq(posts.id, params.postId))
        .run();
    } catch {
      // Non-blocking database binding update
    }
  }

  return {
    success: true,
    shortUrl: result.shortUrl,
    qrCodeUrl: result.qrCodeUrl,
  };
}
