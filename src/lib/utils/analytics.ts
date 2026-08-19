/**
 * Utilities for extracting device classifications and browser vendors from User-Agent strings.
 */

export interface ParsedClientInfo {
  device: "desktop" | "mobile" | "tablet";
  browser: string;
}

/**
 * Extracts device category (mobile, tablet, desktop) and browser vendor from a User-Agent string.
 *
 * @param userAgent - Raw client User-Agent string.
 * @returns Object with normalized device and browser identifiers.
 */
export function parseDeviceAndBrowser(userAgent: string): ParsedClientInfo {
  if (!userAgent || typeof userAgent !== "string") {
    return { device: "desktop", browser: "Other" };
  }

  const ua = userAgent.toLowerCase();

  // 1. Device category detection
  let device: "desktop" | "mobile" | "tablet" = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (ua.includes("android") && !ua.includes("mobile"))) {
    device = "tablet";
  } else if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    device = "mobile";
  }

  // 2. Browser vendor detection (order-sensitive due to compound User-Agent strings)
  let browser = "Other";
  if (ua.includes("edg/") || ua.includes("edge/")) {
    browser = "Edge";
  } else if (ua.includes("opr/") || ua.includes("opera")) {
    browser = "Opera";
  } else if (ua.includes("samsungbrowser")) {
    browser = "Samsung Internet";
  } else if (ua.includes("brave")) {
    browser = "Brave";
  } else if (ua.includes("vivaldi")) {
    browser = "Vivaldi";
  } else if (ua.includes("duckduckgo")) {
    browser = "DuckDuckGo";
  } else if (ua.includes("firefox") || ua.includes("fxios")) {
    browser = "Firefox";
  } else if (ua.includes("chrome") || ua.includes("crios") || ua.includes("chromium")) {
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android")) {
    browser = "Safari";
  } else if (ua.includes("msie") || ua.includes("trident/")) {
    browser = "Internet Explorer";
  }

  return { device, browser };
}
