import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...target };
  for (const key of Object.keys(source || {})) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Server-side request configuration loader for Next-Intl.
 * Dynamically loads translation dictionaries, automatically merging fallback strings to prevent missing key errors.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  let defaultMessages: Record<string, any> = {};
  try {
    defaultMessages = (await import(`../../messages/en.json`)).default;
  } catch {
    defaultMessages = {};
  }

  let localeMessages: Record<string, any> = {};
  if (locale !== "en") {
    try {
      localeMessages = (await import(`../../messages/${locale}.json`)).default;
    } catch {
      localeMessages = {};
    }
  }

  return {
    locale,
    messages: deepMerge(defaultMessages, localeMessages),
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        console.warn(`[next-intl] ${error.message}`);
      } else {
        console.error(error);
      }
    },
    getMessageFallback({ key, namespace }) {
      return `${namespace ? `${namespace}.` : ""}${key}`;
    },
  };
});
