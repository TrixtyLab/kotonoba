"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import { Clock } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Properties configuring the blog sidebar column.
 */
export interface LineSidebarProps {
  /** Site branding and biography information. */
  site: {
    name: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
  };
  /** Latest published articles list. */
  latestPosts?: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt: Date | null;
  }>;
  /** Taxonomy categories list. */
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  /** Explicit language code override. */
  locale?: string;
}

/**
 * Clean blog sidebar column presenting creator identity, recent articles list, taxonomy categories, and monthly archive links.
 *
 * @param props - LineSidebarProps configuring site profile, recent post lists, and categories.
 * @returns React JSX sidebar aside element.
 */
export function LineSidebar({
  site,
  latestPosts = [],
  categories = [],
  locale: propLocale,
}: LineSidebarProps) {
  const t = useTranslations("blog");
  const currentLocale = useLocale() || propLocale || "en";

  const avatar = site.logoUrl;
  const name = getLocalizedText(site.name, currentLocale);
  const bio = getLocalizedText(site.description, currentLocale) || getLocalizedText(site.subtitle, currentLocale);

  return (
    <aside className="w-full space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-3">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-28 h-28 rounded-full object-cover shadow-xs border border-border/40"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-surface-hover/80 border border-border/60 flex items-center justify-center text-3xl font-bold text-text-muted">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="space-y-1">
          <h2 className="text-lg font-bold text-text tracking-tight">{name}</h2>
          {bio && (
            <p className="text-xs text-text-muted leading-relaxed max-w-xs whitespace-pre-line">
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* Latest Posts */}
      {latestPosts.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-border/40 text-left">
          <h3 className="text-xs font-bold text-text tracking-wider uppercase">
            {t("latestPosts")}
          </h3>
          <ul className="space-y-2.5 text-xs">
            {latestPosts.slice(0, 5).map((p) => (
              <li key={p.id} className="leading-snug">
                <Link
                  href={`/entry/${p.slug}`}
                  className="text-text-muted hover:text-accent transition-colors block line-clamp-2"
                >
                  {p.title}
                </Link>
                {p.publishedAt && (
                  <span className="text-[10px] text-text-muted/60 block mt-0.5 font-mono">
                    {formatDate(p.publishedAt, currentLocale)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-border/40 text-left">
          <h3 className="text-xs font-bold text-text tracking-wider uppercase">
            {t("category")}
          </h3>
          <ul className="space-y-1.5 text-xs">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  className="text-text-muted hover:text-accent transition-colors flex items-center justify-between"
                >
                  <span>{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Archive */}
      <div className="space-y-3 pt-6 border-t border-border/40 text-left">
        <h3 className="text-xs font-bold text-text tracking-wider uppercase">
          {t("archive")}
        </h3>
        <Link
          href="/archive"
          className="text-xs text-text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t("monthlyArchive")}</span>
        </Link>
      </div>
    </aside>
  );
}
