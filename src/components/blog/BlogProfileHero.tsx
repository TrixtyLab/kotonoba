import React from "react";
import { Link } from "@/i18n/routing";
import { CheckCircle2, BookOpen, Folder, Tag, Share2 } from "lucide-react";
import { useLocale } from "next-intl";
import { getLocalizedText } from "@/lib/utils/localization";

/**
 * Configuration properties for the BlogProfileHero presentation banner.
 */
export interface BlogProfileHeroProps {
  /** Site branding and metadata. */
  site: {
    name: string;
    subtitle?: string | null;
    description?: string | null;
    logoUrl?: string | null;
  };
  /** Primary author identity. */
  author: {
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
  };
  /** Category taxonomy items for filter pill navigation. */
  categories: Array<{ id: string; name: string; slug: string }>;
  /** Currently active category filter slug, if any. */
  activeCategorySlug?: string;
  /** Numerical site metrics. */
  stats?: {
    postsCount: number;
    categoriesCount: number;
    tagsCount: number;
  };
}

/**
 * Top profile hero banner displaying the creator avatar, official verified badge, biography tagline, publication stats, and category navigation tabs.
 *
 * @param props - BlogProfileHeroProps configuring creator bio, stats, and category taxonomy.
 * @returns React JSX hero section element.
 */
export function BlogProfileHero({
  site,
  author,
  categories,
  activeCategorySlug,
  stats,
}: BlogProfileHeroProps) {
  const locale = useLocale();
  const avatar = author.avatarUrl || site.logoUrl;
  const siteName = getLocalizedText(site.name, locale);
  const name = author.displayName || siteName;
  const siteSubtitle = getLocalizedText(site.subtitle, locale);
  const siteDescription = getLocalizedText(site.description, locale);
  const bio = author.bio || siteSubtitle || siteDescription;

  return (
    <section className="card-clean p-6 sm:p-8 space-y-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 sm:gap-6">
        <div className="relative shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-extrabold ring-4 ring-primary/20 shadow-md">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md ring-2 ring-surface"
            title="Blog Oficial Verificado"
          >
            <CheckCircle2 className="w-4 h-4 fill-white text-primary" />
          </div>
        </div>

        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
                  {name}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                  Oficial
                </span>
              </div>
              {site.name !== name && (
                <p className="text-xs font-semibold text-text-muted mt-0.5">{site.name}</p>
              )}
            </div>

            {stats && (
              <div className="flex items-center justify-center sm:justify-end gap-5 text-center pt-2 sm:pt-0">
                <div>
                  <span className="block text-base sm:text-lg font-bold text-text tabular-nums">
                    {stats.postsCount}
                  </span>
                  <span className="text-[11px] text-text-muted">Artículos</span>
                </div>
                <div className="w-px h-6 bg-border" />
                <div>
                  <span className="block text-base sm:text-lg font-bold text-text tabular-nums">
                    {stats.categoriesCount}
                  </span>
                  <span className="text-[11px] text-text-muted">Categorías</span>
                </div>
                <div className="w-px h-6 bg-border" />
                <div>
                  <span className="block text-base sm:text-lg font-bold text-text tabular-nums">
                    {stats.tagsCount}
                  </span>
                  <span className="text-[11px] text-text-muted">Etiquetas</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
            {bio}
          </p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="pt-4 border-t border-border/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-full transition-all shrink-0 select-none ${
                !activeCategorySlug
                  ? "bg-primary text-bg shadow-2xs font-bold"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              Todos los artículos
            </Link>

            {categories.map((cat) => {
              const isActive = activeCategorySlug === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className={`px-3 py-1.5 rounded-full transition-all shrink-0 select-none ${
                    isActive
                      ? "bg-primary text-bg shadow-2xs font-bold"
                      : "text-text-muted hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
