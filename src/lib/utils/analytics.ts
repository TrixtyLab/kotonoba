/**
 * Client device classification, browser vendor, and operating system extracted from User-Agent.
 */
export interface ParsedClientInfo {
  device: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
}

const BROWSER_MATCHERS: Array<[RegExp, string]> = [
  [/edg\/|edge\//, "Edge"],
  [/opr\/|opera/, "Opera"],
  [/samsungbrowser/, "Samsung Internet"],
  [/brave/, "Brave"],
  [/vivaldi/, "Vivaldi"],
  [/duckduckgo/, "DuckDuckGo"],
  [/firefox|fxios/, "Firefox"],
  [/chrome|crios|chromium/, "Chrome"],
  [/msie|trident\//, "Internet Explorer"],
];

const OS_MATCHERS: Array<[RegExp, string]> = [
  [/iphone|ipad|ipod/i, "iOS"],
  [/android/i, "Android"],
  [/windows|win32|win64/i, "Windows"],
  [/macintosh|mac os x/i, "macOS"],
  [/cros/i, "Chrome OS"],
  [/linux/i, "Linux"],
];

function detectDevice(ua: string): "desktop" | "mobile" | "tablet" {
  if (/ipad|tablet|playbook|silk/i.test(ua) || (ua.includes("android") && !ua.includes("mobile"))) {
    return "tablet";
  }
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function detectBrowser(ua: string): string {
  for (const [pattern, name] of BROWSER_MATCHERS) {
    if (pattern.test(ua)) return name;
  }
  if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android")) {
    return "Safari";
  }
  return "Other";
}

function detectOs(ua: string): string {
  for (const [pattern, name] of OS_MATCHERS) {
    if (pattern.test(ua)) return name;
  }
  return "Other";
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
  return {
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    os: detectOs(ua),
  };
}

