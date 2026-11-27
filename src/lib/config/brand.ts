/** Closed set of font families a site may store and the public blog may render. */
export const BRAND_FONTS = [
  { id: "Inter", stack: "Inter, sans-serif" },
  { id: "Georgia", stack: "Georgia, serif" },
  { id: "Palatino", stack: "Palatino, 'Palatino Linotype', serif" },
  { id: "system-ui", stack: "system-ui, sans-serif" },
  { id: "ui-monospace", stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
] as const;

export type BrandFontId = (typeof BRAND_FONTS)[number]["id"];

/**
 * Maps a stored font name to an allowlisted family.
 * Unknown or empty values fall back to Inter.
 *
 * @param value - Raw `font_family` from the site row or a settings form.
 * @returns The allowlisted id and the CSS font stack to apply.
 */
export function resolveBrandFont(value: string | null | undefined): { id: BrandFontId; stack: string } {
  const requested = (value || "").trim();
  const match = BRAND_FONTS.find((font) => font.id === requested);
  return match ?? BRAND_FONTS[0];
}
