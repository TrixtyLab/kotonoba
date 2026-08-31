import React from "react";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { Link } from "@/i18n/routing";

/**
 * Properties configuring the HeaderBanner component.
 */
export interface HeaderBannerProps {
  /** Source image URL for the banner. */
  imageUrl?: string | null;
  /** Optional target navigation URL. */
  linkUrl?: string | null;
  /** Target link window frame mode. */
  target?: "_blank" | "_self" | string;
  /** Optional accessibility image description. */
  alt?: string;
}

/**
 * Full-width top banner displayed above the blog navigation header with optional hyperlink action.
 *
 * @param props - HeaderBannerProps configuring banner image source, target link, and dimensions.
 * @returns React JSX header banner container or null if no image is configured.
 */
export function HeaderBanner({
  imageUrl,
  linkUrl,
  target = "_blank",
  alt = "Header Banner",
}: HeaderBannerProps) {
  if (!imageUrl || !imageUrl.trim()) return null;

  const resolvedUrl = normalizeMediaUrl(imageUrl);
  if (!resolvedUrl) return null;

  const imageElement = (
    <img
      src={resolvedUrl}
      alt={alt}
      className="w-full h-[160px] sm:h-[220px] md:h-[302px] object-cover"
    />
  );

  if (linkUrl && linkUrl.trim()) {
    const cleanLink = linkUrl.trim();
    const isExternal = cleanLink.startsWith("http://") || cleanLink.startsWith("https://") || cleanLink.startsWith("//");

    if (isExternal) {
      return (
        <aside aria-label="Header Banner" className="w-full overflow-hidden bg-surface-hover/20">
          <a
            href={cleanLink}
            target={target}
            rel={target === "_blank" ? "noopener noreferrer" : undefined}
            className="block w-full h-[160px] sm:h-[220px] md:h-[302px] hover:opacity-95 transition-opacity"
          >
            {imageElement}
          </a>
        </aside>
      );
    }

    return (
      <aside aria-label="Header Banner" className="w-full overflow-hidden bg-surface-hover/20">
        <Link
          href={cleanLink}
          className="block w-full h-[160px] sm:h-[220px] md:h-[302px] hover:opacity-95 transition-opacity"
        >
          {imageElement}
        </Link>
      </aside>
    );
  }

  return (
    <aside aria-label="Header Banner" className="w-full overflow-hidden bg-surface-hover/20">
      <div className="w-full h-[160px] sm:h-[220px] md:h-[302px]">
        {imageElement}
      </div>
    </aside>
  );
}
