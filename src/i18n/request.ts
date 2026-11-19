import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

type MessageDictionary = Record<string, unknown>;

function isPlainObject(value: unknown): value is MessageDictionary {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target: MessageDictionary, source: MessageDictionary): MessageDictionary {
  const result: MessageDictionary = { ...target };
  for (const key of Object.keys(source || {})) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
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

  let defaultMessages: MessageDictionary = {};
  try {
    defaultMessages = (await import(`../../messages/en.json`)).default;
  } catch {
    defaultMessages = {};
  }

  let localeMessages: MessageDictionary = {};
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
