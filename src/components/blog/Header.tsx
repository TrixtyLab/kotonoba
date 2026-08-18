"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Menu, X, Shield } from "lucide-react";

export interface HeaderProps {
  site: {
    name: string;
    subtitle?: string | null;
    logoUrl?: string | null;
  };
  categories: Array<{ id: string; name: string; slug: string }>;
}

/**
 * Public blog header navigation with responsive mobile menu, locale switcher, and theme toggle.
 */
export function Header({ site, categories }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/80 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          {site.logoUrl ? (
            <img src={site.logoUrl} alt={site.name} className="w-8 h-8 rounded-md object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-bold text-base shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              {site.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-bold text-base sm:text-lg text-text tracking-tight block">
              {site.name}
            </span>
            {site.subtitle && (
              <span className="text-[11px] text-text-muted hidden md:block line-clamp-1">
                {site.subtitle}
              </span>
            )}
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          {categories.slice(0, 4).map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="hover:text-primary transition-colors">
              {c.name}
            </Link>
          ))}
          <Link href="/archive" className="hover:text-primary transition-colors">
            Archive
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link
            href="/admin"
            className="hidden sm:inline-flex p-2 rounded-md text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            title="Admin Dashboard"
            aria-label="Admin Dashboard"
          >
            <Shield className="w-4 h-4" />
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden glass border-b border-border p-4 animate-slide-down space-y-3">
          <div className="flex flex-col space-y-2 text-sm font-medium">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-surface-hover text-text"
            >
              Home
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md hover:bg-surface-hover text-text-muted hover:text-text"
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/archive"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-surface-hover text-text-muted hover:text-text"
            >
              Archive
            </Link>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md hover:bg-surface-hover text-primary font-semibold flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
