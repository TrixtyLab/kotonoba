/**
 * Extracts a localized string from either a JSON-serialized multilingual dictionary or a plain string.
 * Transparently falls back to secondary supported languages or the first available value when the requested locale is missing.
 *
 * @param rawText - The source string, which may be plain text or a JSON dictionary (e.g., '{"es":"Hola","en":"Hello"}').
 * @param locale - The preferred language code to extract (e.g., 'en', 'es'). Defaults to 'en'.
 * @returns The resolved localized text corresponding to the requested locale or fallback language.
 */
export function getLocalizedText(rawText: string | null | undefined, locale: string = "en"): string {
  if (!rawText) return "";

  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        if (locale && parsed[locale] && typeof parsed[locale] === "string" && parsed[locale].trim()) {
          return parsed[locale].trim();
        }
        if (parsed["en"] && typeof parsed["en"] === "string" && parsed["en"].trim()) {
          return parsed["en"].trim();
        }
        if (parsed["es"] && typeof parsed["es"] === "string" && parsed["es"].trim()) {
          return parsed["es"].trim();
        }
        for (const val of Object.values(parsed)) {
          if (typeof val === "string" && val.trim()) {
            return val.trim();
          }
        }
      }
    } catch {
      return rawText;
    }
  }

  return rawText;
}

/**
 * Parses a multilingual string or dictionary into a normalized key-value mapping of locale codes to text values.
 *
 * @param rawText - Source multilingual JSON string or raw text to parse.
 * @param defaultLocales - List of locale codes to initialize within the returned dictionary. Defaults to ['en', 'es'].
 * @returns A normalized mapping where each locale code maps to its corresponding localized string.
 */
export function getLocalizedMap(rawText: string | null | undefined, defaultLocales: string[] = ["en", "es"]): Record<string, string> {
  const map: Record<string, string> = {};
  defaultLocales.forEach((l) => {
    map[l] = "";
  });

  if (!rawText) return map;

  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") {
            map[k] = v;
          }
        }
        return map;
      }
    } catch {
      // Fallback to plain string assignment below
    }
  }

  defaultLocales.forEach((l) => {
    map[l] = rawText;
  });
  return map;
}

/**
 * Serializes a locale-to-string dictionary into a compact JSON string or plain string for database storage.
 *
 * @param map - The dictionary mapping locale codes to their respective localized strings.
 * @param defaultLocale - The primary default locale. Defaults to 'en'.
 * @returns A serialized JSON string representing the multilingual mapping, or a plain string if only 1 language is present.
 */
export function packLocalizedMap(map: Record<string, string>, defaultLocale: string = "en"): string {
  const cleanEntries = Object.entries(map)
    .map(([k, v]) => [k, v.trim()] as const)
    .filter(([_, v]) => v.length > 0);

  if (cleanEntries.length === 0) return "";
  if (cleanEntries.length === 1) {
    return cleanEntries[0][1];
  }

  const values = new Set(cleanEntries.map(([_, v]) => v));
  if (values.size === 1) {
    return cleanEntries[0][1];
  }

  const result: Record<string, string> = {};
  for (const [k, v] of cleanEntries) {
    result[k] = v;
  }
  return JSON.stringify(result);
}
