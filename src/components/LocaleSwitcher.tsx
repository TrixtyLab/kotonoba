"use client";

import { useTransition, useState, useMemo } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/routing";
import { Globe, Check, Search } from "lucide-react";

/**
 * Interactive language switcher dropdown supporting real-time search filtering across 70+ localized languages.
 *
 * @returns React JSX locale selector dropdown element.
 */
export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLocales = useMemo(() => {
    if (!search.trim()) return LOCALES;
    const q = search.toLowerCase();
    return LOCALES.filter(
      (l) => l.includes(q) || (LOCALE_NAMES[l] && LOCALE_NAMES[l].toLowerCase().includes(q))
    );
  }, [search]);

  function handleSelect(nextLocale: Locale): void {
    setIsOpen(false);
    setSearch("");
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change language"
        aria-expanded={isOpen}
        disabled={isPending}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md hover:bg-surface-hover transition-colors btn-press text-text-muted hover:text-text"
      >
        <Globe className="w-4 h-4 text-primary" />
        <span className="uppercase text-xs tracking-wider">{currentLocale}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-hidden glass-strong rounded-lg shadow-2xl z-50 p-2 border border-border animate-slide-down flex flex-col">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search language…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-input border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border/20">
              {filteredLocales.map((l) => (
                <button
                  key={l}
                  onClick={() => handleSelect(l)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded hover:bg-surface-hover transition-colors text-text"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-muted uppercase text-[10px] w-6">{l}</span>
                    <span>{LOCALE_NAMES[l] || l}</span>
                  </div>
                  {currentLocale === l && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
              {filteredLocales.length === 0 && (
                <div className="p-3 text-center text-xs text-text-muted">No languages found.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
