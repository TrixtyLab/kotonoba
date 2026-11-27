import React from "react";
import { Globe } from "lucide-react";

/**
 * Properties for the CountryFlag component.
 */
export interface CountryFlagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 2-letter ISO 3166-1 alpha-2 country code (e.g. 'US', 'PL', 'ES', 'CA', 'SG'). */
  code?: string | null;
  /** Active BCP-47 locale code for localized country name translation (defaults to 'en'). */
  locale?: string;
  /** When true, renders the localized full country name alongside the flag icon. */
  showName?: boolean;
  /** When true, renders the 2-letter uppercase ISO code, e.g. '(US)'. */
  showCode?: boolean;
  /** Size variant of the flag icon. */
  size?: "xs" | "sm" | "md";
  /** Optional custom CSS classes for the flag image. */
  flagClassName?: string;
}

/**
 * Resolves the localized human-readable country name from a 2-letter ISO code using Intl.DisplayNames.
 *
 * @param countryCode - 2-letter ISO country code.
 * @param locale - Desired locale tag (e.g. 'es', 'en').
 * @returns Localized country name string or fallback code.
 */
export function getCountryName(countryCode?: string | null, locale = "en"): string {
  if (!countryCode || typeof countryCode !== "string") return "";
  const clean = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return countryCode;
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(clean) || clean;
  } catch {
    return clean;
  }
}

const SIZE_STYLES = {
  xs: "w-3.5 h-2.5",
  sm: "w-4.5 h-3",
  md: "w-5.5 h-3.5",
};

function resolveCountryFlagView(
  code: string | null | undefined,
  locale: string,
  size: "xs" | "sm" | "md",
  title?: string
) {
  const cleanCode = code ? code.trim().toUpperCase() : "";
  const isValidIso = /^[A-Z]{2}$/.test(cleanCode);
  const englishName = isValidIso ? getCountryName(cleanCode, "en") : cleanCode;
  const countryName = isValidIso ? getCountryName(cleanCode, locale) : cleanCode;
  return {
    cleanCode,
    isValidIso,
    isoLower: cleanCode.toLowerCase(),
    displayLabel: countryName || cleanCode || "Global",
    sizeClass: SIZE_STYLES[size] || SIZE_STYLES.sm,
    globeSizeClass: size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5",
    tooltipText: title !== undefined ? title : englishName || cleanCode || "Global",
  };
}

/**
 * High-performance, cross-platform country flag badge component.
 * Renders crisp CDN SVG/PNG flag icons with high-DPI retina srcset,
 * ensuring flawless visual presentation across Windows, macOS, Linux, and mobile.
 */
export function CountryFlag({
  code,
  locale = "en",
  showName = false,
  showCode = false,
  size = "sm",
  flagClassName = "",
  className = "",
  title,
  ...rest
}: CountryFlagProps): React.JSX.Element {
  const view = resolveCountryFlagView(code, locale, size, title);

  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle ${className}`}
      title={view.tooltipText}
      {...rest}
    >
      {view.isValidIso ? (
        <span className="relative inline-flex items-center justify-center shrink-0">
          <img
            src={`https://flagcdn.com/w40/${view.isoLower}.png`}
            srcSet={`https://flagcdn.com/w80/${view.isoLower}.png 2x`}
            width={20}
            height={15}
            alt={view.displayLabel}
            loading="lazy"
            className={`${view.sizeClass} object-cover rounded-[2px] shadow-2xs border border-black/10 dark:border-white/15 shrink-0 ${flagClassName}`}
          />
        </span>
      ) : (
        <Globe className={`${view.globeSizeClass} text-text-muted shrink-0`} />
      )}

      {showName && <span className="truncate">{view.displayLabel}</span>}

      {showCode && view.isValidIso && (
        <span className="text-[11px] font-mono text-text-muted font-normal shrink-0">
          ({view.cleanCode})
        </span>
      )}
    </span>
  );
}
