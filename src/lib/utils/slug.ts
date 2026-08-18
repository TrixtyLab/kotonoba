import slugifyLib from "slugify";
import { nanoid } from "nanoid";

export function generateSlug(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, trim: true });
}

export function generateId(): string {
  return nanoid(21);
}
