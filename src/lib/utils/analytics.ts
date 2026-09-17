/**
 * Client device classification, browser vendor, and operating system extracted from User-Agent.
 */
export interface ParsedClientInfo {
  device: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
}

/**
 * Extracts normalized device category, browser vendor, and operating system name from a raw User-Agent string.
 *
 * @param {string} userAgent - Raw client User-Agent string from request headers.
 * @returns {ParsedClientInfo} Normalized device classification, browser name, and operating system.
 */
export function parseDeviceAndBrowser(userAgent: string): ParsedClientInfo {
  if (!userAgent || typeof userAgent !== "string") {
    return { device: "desktop", browser: "Other", os: "Other" };
  }

  const ua = userAgent.toLowerCase();

  let device: "desktop" | "mobile" | "tablet" = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (ua.includes("android") && !ua.includes("mobile"))) {
    device = "tablet";
  } else if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    device = "mobile";
  }

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

  let os = "Other";
  if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/windows|win32|win64/i.test(ua)) {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  return { device, browser, os };
}

