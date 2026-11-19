import sharp from "sharp";

const MAX_IMAGE_DIMENSION = 16_384;
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * Supported verified raster image upload types and their canonical extensions.
 */
export interface DetectedImageType {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  extension: ".jpg" | ".png" | ".webp" | ".gif";
}

/** Re-encoded raster payload with metadata stripped. */
export interface SanitizedImagePayload {
  buffer: Buffer;
  width?: number;
  height?: number;
  mimeType: DetectedImageType["mimeType"];
  extension: DetectedImageType["extension"];
}

/**
 * Inspects leading file magic bytes to identify genuine JPEG, PNG, GIF, or WebP images.
 * Rejects HTML, SVG, scripts, polyglots, or unsupported binary payloads regardless of filename or HTTP header.
 *
 * @param buffer - Uploaded binary file buffer.
 * @returns Detected image MIME type and safe canonical extension, or `null` when unrecognized.
 */
export function detectImageTypeFromBytes(buffer: Buffer): DetectedImageType | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: ".png" };
  }

  // GIF87a / GIF89a
  const header6 = buffer.subarray(0, 6).toString("ascii");
  if (header6 === "GIF87a" || header6 === "GIF89a") {
    return { mimeType: "image/gif", extension: ".gif" };
  }

  // WebP: RIFF....WEBP
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return { mimeType: "image/webp", extension: ".webp" };
  }

  return null;
}

/**
 * Decodes and re-encodes raster image uploads via `sharp` to validate structural integrity,
 * enforce safe dimensions (mitigating decompression bombs), strip EXIF/IPTC/XMP metadata,
 * and eliminate trailing polyglot payloads.
 *
 * @param buffer - Raw uploaded binary buffer.
 * @param detected - Magic-byte matched raster image descriptor.
 * @returns Sanitized re-encoded buffer and metadata, or `null` if invalid or oversized.
 */
export async function sanitizeUploadedImage(
  buffer: Buffer,
  detected: DetectedImageType
): Promise<SanitizedImagePayload | null> {
  try {
    const isAnimatedGif = detected.mimeType === "image/gif";
    const instance = sharp(buffer, {
      animated: isAnimatedGif,
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    });

    const meta = await instance.metadata();
    if (!meta.width || !meta.height) {
      return null;
    }
    if (meta.width > MAX_IMAGE_DIMENSION || meta.height > MAX_IMAGE_DIMENSION) {
      return null;
    }

    let output: Buffer;
    switch (detected.mimeType) {
      case "image/jpeg":
        output = await instance.rotate().jpeg({ quality: 92 }).toBuffer();
        break;
      case "image/png":
        output = await instance.rotate().png().toBuffer();
        break;
      case "image/webp":
        output = await instance.rotate().webp({ quality: 92 }).toBuffer();
        break;
      case "image/gif":
        output = await instance.gif({ effort: 1 }).toBuffer();
        break;
    }

    return {
      buffer: output,
      width: meta.width,
      height: meta.height,
      mimeType: detected.mimeType,
      extension: detected.extension,
    };
  } catch {
    return null;
  }
}
