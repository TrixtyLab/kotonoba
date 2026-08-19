"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SearchModal, type SearchPostItem } from "@/components/blog/SearchModal";
import { NavIcon } from "@/components/blog/NavIcon";
import { Search, Menu, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

/**
 * Custom navigation menu item structure supporting bilingual labels and icons.
 */
export interface CustomNavItem {
  /** Unique item identifier. */
  id: string;
  /** Primary label fallback string. */
  label: string;
  /** Spanish label string. */
  label_es?: string;
  /** English label string. */
  label_en?: string;
  /** Multilingual dictionary of labels. */
  labels?: Record<string, string>;
  /** Destination route path or external URL. */
  url: string;
  /** Lucide icon identifier string. */
  icon?: string;
  /** Link target attribute. */
  target?: "_self" | "_blank";
  /** Flag denoting whether the item is fixed in the navigation bar. */
  isFixed?: boolean;
}

/**
 * Configuration properties for the blog Header component.
 */
export interface HeaderProps {
  /** Site branding and navigation links configuration. */
  site: {
    name: string;
    subtitle?: string | null;
    logoUrl?: string | null;
    navLinks?: string | null;
    navAlignment?: "left" | "center" | "right" | null;
  };
  /** Category taxonomy items for menu fallback. */
  categories?: Array<{ id: string; name: string; slug: string }>;
  /** Searchable post items list. */
  searchPosts?: SearchPostItem[];
}

/**
 * Clean blog navigation header with uppercase text links, search modal trigger, and theme toggle controls.
 *
 * @param props - HeaderProps configuring site branding, navigation links, and searchable posts.
 * @returns React JSX header element.
 */
export function Header({ site, categories = [], searchPosts = [] }: HeaderProps) {
  const t = useTranslations("blog");
  const locale = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function getNavItemLabel(item: CustomNavItem): string {
    if (item.id === "home" || item.isFixed || item.url === "/") {
      return t("top").toUpperCase();
    }
    if (item.labels && item.labels[locale]) {
      return item.labels[locale].toUpperCase();
    }
    if (locale === "es" && item.label_es) return item.label_es.toUpperCase();
    if (locale === "en" && item.label_en) return item.label_en.toUpperCase();
    return item.label.toUpperCase();
  }

  const navItems = useMemo<CustomNavItem[]>(() => {
    let customList: CustomNavItem[] = [];

    if (site.navLinks) {
      try {
        const parsed = JSON.parse(site.navLinks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customList = parsed;
        }
      } catch {
        // Fall back
      }
    }

    if (customList.length > 0) {
      const homeConfig = customList.find((i) => i.id === "home" || i.url === "/" || i.isFixed);
      const nonHomeCustomLinks = customList.filter((i) => i.id !== "home" && i.url !== "/" && !i.isFixed);

      const homeItem: CustomNavItem = {
        id: "home",
        label: homeConfig?.label || t("top").toUpperCase(),
        label_es: homeConfig?.label_es,
        label_en: homeConfig?.label_en,
        labels: homeConfig?.labels,
        url: "/",
        icon: homeConfig?.icon,
        isFixed: true,
      };

      return [homeItem, ...nonHomeCustomLinks];
    }

    const defaultHome: CustomNavItem = {
      id: "home",
      label: t("top").toUpperCase(),
      url: "/",
      isFixed: true,
    };

    const categoryItems: CustomNavItem[] = categories.slice(0, 5).map((c) => ({
      id: `cat-${c.id}`,
      label: c.name.toUpperCase(),
      url: `/category/${c.slug}`,
    }));

    const archiveItem: CustomNavItem = {
      id: "archive",
      label: t("archive").toUpperCase(),
      url: "/archive",
    };

    return [defaultHome, ...categoryItems, archiveItem];
  }, [site.navLinks, categories, t]);

  const alignmentClass = useMemo(() => {
    switch (site.navAlignment) {
      case "left":
        return "justify-start";
      case "right":
        return "justify-end";
      case "center":
      default:
        return "justify-center";
    }
  }, [site.navAlignment]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-border/80 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            <nav className={`hidden md:flex items-stretch gap-8 h-full flex-1 ${alignmentClass}`}>
              {navItems.map((item) => {
                const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://");
                const isActive = !isExternal && (pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url)));
                const label = getNavItemLabel(item);

                if (isExternal) {
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.target || "_blank"}
                      rel="noopener noreferrer"
                      className="relative h-full flex items-center px-1 text-xs sm:text-[13px] font-bold tracking-wider text-text-muted hover:text-accent transition-colors flex items-center gap-1.5 select-none uppercase after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-transparent hover:after:bg-accent/40"
                    >
                      {item.icon && <NavIcon name={item.icon} className="w-4 h-4 text-accent" />}
                      <span>{label}</span>
                    </a>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.url}
                    target={item.target}
                    className={`relative h-full flex items-center px-1 text-xs sm:text-[13px] font-bold tracking-wider transition-colors flex items-center gap-1.5 select-none uppercase after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] ${
                      isActive
                        ? "text-accent font-extrabold after:bg-accent"
                        : "text-text-muted hover:text-text after:bg-transparent hover:after:bg-text-muted/40"
                    }`}
                  >
                    {item.icon && (
                      <NavIcon
                        name={item.icon}
                        className={`w-4 h-4 ${isActive ? "text-accent" : "text-text-muted"}`}
                      />
                    )}
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right toolbar: Search, Locale Switcher, Theme Toggle, Mobile Trigger */}
            <div className="flex items-center gap-2.5 ml-auto shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar artículos"
                title="Buscar (⌘K)"
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>

              <LocaleSwitcher />
              <ThemeToggle />

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface px-4 py-3 space-y-1 animate-slide-down">
            {navItems.map((item) => {
              const isExternal = item.url.startsWith("http://") || item.url.startsWith("https://");
              const isActive = !isExternal && (pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url)));
              const label = getNavItemLabel(item);

              if (isExternal) {
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.target || "_blank"}
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text hover:bg-surface-hover uppercase tracking-wider"
                  >
                    {item.icon && <NavIcon name={item.icon} className="w-4 h-4 text-accent" />}
                    <span>{label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.url}
                  target={item.target}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                    isActive
                      ? "text-accent font-bold bg-accent/10"
                      : "text-text-muted hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  {item.icon && <NavIcon name={item.icon} className="w-4 h-4 text-accent" />}
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        posts={searchPosts}
      />
    </>
  );
}
