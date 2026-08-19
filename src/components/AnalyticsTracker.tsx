"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";

/**
 * Invisible tracking beacon client component recording authentic pageview metrics and UTM campaign parameters.
 *
 * @param props - Object containing the active siteId and optional postId.
 * @returns Null component output.
 */
export function AnalyticsTracker({ siteId, postId }: { siteId: string; postId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && (window.navigator as unknown as { webdriver?: boolean }).webdriver) {
        return;
      }

      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const utmSource = params?.get("utm_source") || undefined;
      const utmMedium = params?.get("utm_medium") || undefined;
      const utmCampaign = params?.get("utm_campaign") || undefined;
      const utmTerm = params?.get("utm_term") || undefined;
      const utmContent = params?.get("utm_content") || undefined;

      fetch("/api/analytics/hit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          postId: postId || null,
          path: pathname,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_term: utmTerm,
          utm_content: utmContent,
        }),
      }).catch(() => {});
    } catch {
      // Ignore network errors on analytics beacon
    }
  }, [siteId, postId, pathname]);

  return null;
}
