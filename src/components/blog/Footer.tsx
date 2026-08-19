"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

/**
 * Properties configuring the public blog footer.
 */
export interface FooterProps {
  /** Display title of the site. */
  siteName: string;
  /** Subtitle tagline. */
  subtitle?: string | null;
  /** Categories array. */
  categories?: Array<{ id: string; name: string; slug: string }>;
  /** Controls visibility of the AI index (llms.txt) hyperlink. */
  enableLlmsTxt?: boolean;
}

/**
 * Public website footer rendering standard navigation links, sitemap references, and conditional LLMs.txt links.
 * Excludes sensitive administration panel routes from public discovery.
 *
 * @param props - FooterProps with site title and LLMs.txt toggle status.
 * @returns React JSX footer element.
 */
export function Footer({ siteName, enableLlmsTxt = true }: FooterProps) {
  const t = useTranslations("blog");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 py-10 mt-16 text-center text-xs text-text-muted">
      <div className="max-w-5xl mx-auto px-4 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px]">
          <Link href="/" className="hover:text-text transition-colors">
            {t("top")}
          </Link>
          <span>|</span>
          <Link href="/archive" className="hover:text-text transition-colors">
            {t("archive")}
          </Link>
          <span>|</span>
          {enableLlmsTxt && (
            <>
              <a href="/llms.txt" target="_blank" rel="noreferrer" className="hover:text-text transition-colors">
                AI Index (llms.txt)
              </a>
              <span>|</span>
            </>
          )}
          <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-text transition-colors">
            Sitemap
          </a>
        </div>

        <p className="text-[11px] text-text-muted/80">
          © {currentYear} {siteName} · Powered by{" "}
          <a
            href="https://github.com/TrixtyLab/kotonoba"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text hover:text-accent transition-colors underline underline-offset-2 font-medium"
          >
            Kotonoba
          </a>
        </p>
      </div>
    </footer>
  );
}
