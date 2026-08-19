import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * Server-side request configuration loader for Next-Intl.
 * Dynamically loads translation dictionaries, automatically merging fallback strings to prevent missing key errors.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  let defaultMessages = {};
  try {
    defaultMessages = (await import(`../../messages/en.json`)).default;
  } catch {
    defaultMessages = {};
  }

  let localeMessages = {};
  if (locale !== "en") {
    try {
      localeMessages = (await import(`../../messages/${locale}.json`)).default;
    } catch {
      localeMessages = {};
    }
  }

  return {
    locale,
    messages: {
      ...defaultMessages,
      ...localeMessages,
    },
  };
});
