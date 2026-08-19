/**
 * Extracts a localized string from either a JSON-serialized multilingual dictionary or a plain string.
 * Transparently falls back to secondary supported languages or the first available value when the requested locale is missing.
 *
 * @param rawText - The source string, which may be plain text or a JSON dictionary (e.g., '{"es":"Hola","en":"Hello"}').
 * @param locale - The preferred language code to extract (e.g., 'es', 'en'). Defaults to 'es'.
 * @returns The resolved localized text corresponding to the requested locale or fallback language.
 */
export function getLocalizedText(rawText: string | null | undefined, locale: string = "es"): string {
  if (!rawText) return "";

  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        if (parsed[locale] && typeof parsed[locale] === "string") {
          return parsed[locale];
        }
        if (parsed["es"] && typeof parsed["es"] === "string") {
          return parsed["es"];
        }
        if (parsed["en"] && typeof parsed["en"] === "string") {
          return parsed["en"];
        }
        const firstVal = Object.values(parsed)[0];
        if (typeof firstVal === "string") return firstVal;
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
 * @param defaultLocales - List of locale codes to initialize within the returned dictionary. Defaults to ['es', 'en'].
 * @returns A normalized mapping where each locale code maps to its corresponding localized string.
 */
export function getLocalizedMap(rawText: string | null | undefined, defaultLocales: string[] = ["es", "en"]): Record<string, string> {
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
 * Serializes a locale-to-string dictionary into a compact JSON string for database storage.
 *
 * @param map - The dictionary mapping locale codes to their respective localized strings.
 * @returns A serialized JSON string representing the multilingual mapping, or an empty string if all values are blank.
 */
export function packLocalizedMap(map: Record<string, string>): string {
  const entries = Object.entries(map).filter(([_, v]) => v && v.trim());
  if (entries.length === 0) return "";
  return JSON.stringify(map);
}
