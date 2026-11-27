"use server";

import { ROLE_ALL } from "@/lib/auth/roles";
import { ROLES } from "@/lib/config/constants";
import { requireAuth } from "@/lib/auth/session";
import { requireResourceAccess, requireSiteAccess } from "@/lib/auth/site-access";
import { bindPostDubShortLink, createDubLink, isDubConfigured } from "@/lib/dub";
import { sanitizeUrl } from "@/lib/security/sanitize";
import { validateOutboundUrl } from "@/lib/security/ssrf";
import { getSiteById } from "@/lib/services/sites";

/** Input parameters for creating a short link via Dub.co. */
export interface GenerateDubLinkParams {
  postId?: string;
  siteId?: string;
  originalUrl: string;
  customSlug?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

/** Generates a campaign-tracked short link via Dub.co and optionally binds it to a blog post. */
export async function generateDubLinkAction(params: GenerateDubLinkParams): Promise<{
  success: boolean;
  shortUrl?: string;
  qrCodeUrl?: string;
  error?: string;
}> {
  const user = await requireAuth(ROLE_ALL);

  if (!isDubConfigured()) {
    return {
      success: false,
      error: "Dub.co integration is not configured. Set DUB_API_KEY in your environment.",
    };
  }

  const safeOriginalUrl = sanitizeUrl(params.originalUrl, { allowRelative: false });
  if (!safeOriginalUrl) {
    return { success: false, error: "Invalid destination URL" };
  }

  // Every destination is validated, including URLs supplied alongside a post or
  // site id, so a shortener cannot be pointed at internal services.
  const outboundCheck = await validateOutboundUrl(safeOriginalUrl);
  if (!outboundCheck.valid) {
    return { success: false, error: "Destination URL is not allowed." };
  }

  if (params.postId) {
    await requireResourceAccess("post", params.postId, ROLE_ALL);
  } else if (params.siteId) {
    await requireSiteAccess(params.siteId, ROLE_ALL);
  } else if (user.role !== ROLES.SUPER_ADMIN) {
    if (!user.siteId) {
      return { success: false, error: "Forbidden" };
    }
    const userSite = getSiteById(user.siteId);
    if (!userSite) {
      return { success: false, error: "Forbidden" };
    }
    const parsedHost = new URL(safeOriginalUrl).host.toLowerCase();
    const siteHost = userSite.domain.toLowerCase();
    if (parsedHost !== siteHost && parsedHost.split(":")[0] !== siteHost.split(":")[0]) {
      return { success: false, error: "Destination URL host does not match your assigned site." };
    }
  }

  const result = await createDubLink({
    url: safeOriginalUrl,
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
      bindPostDubShortLink(params.postId, result.shortUrl, result.id);
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
