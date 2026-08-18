"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";

/**
 * Invisible tracking beacon recording pageviews without persistent third-party cookies.
 */
export function AnalyticsTracker({ siteId, postId }: { siteId: string; postId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/analytics/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        postId: postId || null,
        path: pathname,
      }),
    }).catch(() => {});
  }, [siteId, postId, pathname]);

  return null;
}
