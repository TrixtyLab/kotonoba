"use client";

import React, { useMemo } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { NavIcon } from "@/components/blog/NavIcon";

/**
 * Custom navigation menu item structure supporting bilingual labels and icons.
 */
export interface FooterNavItem {
  id: string;
  label: string;
  label_es?: string;
  label_en?: string;
  labels?: Record<string, string>;
  url: string;
  icon?: string;
  target?: "_self" | "_blank";
  isSocial?: boolean;
}

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
  /** Serialized JSON string of navigation and social links. */
  navLinks?: string | null;
}

/**
 * Public website footer rendering social channel icons, standard navigation links, sitemap references, and conditional LLMs.txt links.
 *
 * @param props - FooterProps with site title, social links, and LLMs.txt toggle status.
 * @returns React JSX footer element.
 */
export function Footer({ siteName, enableLlmsTxt = true, navLinks }: FooterProps) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const currentYear = new Date().getFullYear();

  const socialLinks = useMemo<FooterNavItem[]>(() => {
    if (!navLinks) return [];
    try {
      const parsed = JSON.parse(navLinks);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => Boolean(item.isSocial));
      }
    } catch {}
    return [];
  }, [navLinks]);

  return (
    <footer className="border-t border-border/50 py-10 mt-16 text-center text-xs text-text-muted">
      <div className="max-w-5xl mx-auto px-4 space-y-4">
        {/* Social Links Row */}
        {socialLinks.length > 0 && (
          <div className="flex items-center justify-center gap-2.5 flex-wrap pb-1">
            {socialLinks.map((item) => {
              const label =
                item.labels?.[locale] ||
                (locale === "es" ? item.label_es : item.label_en) ||
                item.label;
              const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://");

              if (isExternal) {
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.target || "_blank"}
                    rel="noopener noreferrer"
                    title={label}
                    aria-label={label}
                    className="w-8 h-8 rounded-full border border-border/70 bg-surface hover:bg-surface-hover hover:border-accent/60 text-text-muted hover:text-accent flex items-center justify-center transition-all duration-150 shadow-2xs hover:scale-105"
                  >
                    <NavIcon name={item.icon || "link"} className="w-3.5 h-3.5" />
                  </a>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.url}
                  target={item.target}
                  title={label}
                  aria-label={label}
                  className="w-8 h-8 rounded-full border border-border/70 bg-surface hover:bg-surface-hover hover:border-accent/60 text-text-muted hover:text-accent flex items-center justify-center transition-all duration-150 shadow-2xs hover:scale-105"
                >
                  <NavIcon name={item.icon || "link"} className="w-3.5 h-3.5" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Standard Footer Navigation */}
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

        {/* Copyright */}
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

