import fs from "fs";

/**
 * Ensures that a target directory exists on the filesystem, creating any missing parent directories recursively.
 *
 * @param dir - Absolute or relative filesystem directory path to verify and create.
 * @returns Void.
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
