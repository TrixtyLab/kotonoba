"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/routing";

/**
 * Retrieves a persistent session UUID from sessionStorage or instantiates a fresh identifier.
 *
 * @returns {string} Unique session identifier string.
 */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const STORAGE_KEY = "kotonoba_session_id";
    let sid = window.sessionStorage.getItem(STORAGE_KEY);
    if (!sid) {
      sid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sid_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem(STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

/**
 * Measures navigation load completion duration in milliseconds.
 *
 * @returns {number | undefined} Elapsed page load milliseconds or undefined if unavailable.
 */
function measureLoadTime(): number | undefined {
  if (typeof window === "undefined" || !window.performance) return undefined;
  try {
    const navEntries = window.performance.getEntriesByType("navigation");
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      if (nav.duration > 0) {
        return Math.round(nav.duration);
      }
      if (nav.loadEventEnd > 0) {
        return Math.round(nav.loadEventEnd - nav.startTime);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Dispatches an engagement heartbeat payload transmitting total seconds spent on the current path.
 *
 * @param {string} siteId - Active blog site unique identifier.
 * @param {string} sessionId - Visitor session token.
 * @param {string} path - Current normalized page route.
 * @param {number} seconds - Elapsed duration on page in seconds.
 * @returns {void}
 */
function sendHeartbeat(siteId: string, sessionId: string, path: string, seconds: number): void {
  if (seconds < 1 || !siteId || !sessionId || !path) return;

  const payload = JSON.stringify({
    siteId,
    sessionId,
    path,
    timeOnPage: Math.round(seconds),
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    const success = navigator.sendBeacon("/api/analytics/heartbeat", blob);
    if (success) return;
  }

  fetch("/api/analytics/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Invisible tracking beacon client component recording authentic pageview metrics,
 * load performance, screen viewport metadata, and periodic engagement heartbeats.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.siteId - Active site identifier.
 * @param {string} [props.postId] - Optional related post database ID.
 * @returns {null} Null component output.
 */
export function AnalyticsTracker({ siteId, postId }: { siteId: string; postId?: string }) {
  const pathname = usePathname();
  const startTimeRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || (window.navigator as unknown as { webdriver?: boolean }).webdriver) {
      return;
    }

    const sessionId = getOrCreateSessionId();
    startTimeRef.current = Date.now();

    const searchParams = new URLSearchParams(window.location.search);
    const utmSource = searchParams.get("utm_source") || undefined;
    const utmMedium = searchParams.get("utm_medium") || undefined;
    const utmCampaign = searchParams.get("utm_campaign") || undefined;
    const utmTerm = searchParams.get("utm_term") || undefined;
    const utmContent = searchParams.get("utm_content") || undefined;

    const initialLoadTime = measureLoadTime();

    fetch("/api/analytics/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        postId: postId || null,
        path: pathname,
        sessionId,
        language: window.navigator.language || "",
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        loadTime: initialLoadTime,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
      }),
    }).catch(() => {});

    heartbeatIntervalRef.current = setInterval(() => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      sendHeartbeat(siteId, sessionId, pathname, elapsedSeconds);
    }, 15000);

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        sendHeartbeat(siteId, sessionId, pathname, elapsedSeconds);
      }
    };

    const handleBeforeUnload = (): void => {
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      sendHeartbeat(siteId, sessionId, pathname, elapsedSeconds);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      sendHeartbeat(siteId, sessionId, pathname, elapsedSeconds);
    };
  }, [siteId, postId, pathname]);

  return null;
}
