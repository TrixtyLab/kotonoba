import slugifyLib from "slugify";
import { nanoid } from "nanoid";

/**
 * Transforms an arbitrary text string into a URL-friendly, lowercase slug.
 *
 * @param text - The raw string to be transformed into a slug format.
 * @returns A sanitized, lowercase, strictly URL-compliant slug string.
 */
export function generateSlug(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, trim: true });
}

/**
 * Generates a collision-resistant unique identifier using nanoid.
 *
 * @returns A 21-character cryptographically random identifier string.
 */
export function generateId(): string {
  return nanoid(21);
}
