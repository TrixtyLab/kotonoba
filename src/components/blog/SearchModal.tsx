"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, FileText, ArrowRight, CornerDownLeft } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

/**
 * Searchable article item structure utilized by the SearchModal dialog.
 */
export interface SearchPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  categoryName?: string | null;
  publishedAt?: string | null;
}

/**
 * Command palette search dialog with keyboard navigation (Up/Down/Enter/Escape) and fuzzy text filtering.
 *
 * @param props - Object containing visibility toggle, close callback, and searchable posts list.
 * @returns React JSX search modal dialog or null when closed.
 */
export function SearchModal({
  isOpen,
  onClose,
  posts,
}: {
  isOpen: boolean;
  onClose: () => void;
  posts: SearchPostItem[];
}) {
  const t = useTranslations("blog");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const filtered = posts.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        router.push(`/entry/${filtered[selectedIndex].slug}`);
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      <div
        className="fixed inset-0 bg-bg/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-10 animate-slide-down flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center px-5 py-4 border-b border-border gap-3">
          <Search className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-transparent text-sm text-text placeholder-text-muted outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
              aria-label={t("clearSearch")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto p-2 divide-y divide-border/20 flex-1">
          {filtered.map((post, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={post.id}
                onClick={() => {
                  router.push(`/entry/${post.slug}`);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? "bg-surface-hover/80 border border-primary/20 shadow-xs"
                    : "hover:bg-surface-hover/50 border border-transparent"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected
                      ? "bg-primary text-bg font-bold"
                      : "bg-surface-hover text-text-muted"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {post.categoryName && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {post.categoryName}
                      </span>
                    )}
                    {post.categoryName && post.publishedAt && (
                      <span className="text-text-muted/40 text-xs">·</span>
                    )}
                    {post.publishedAt && (
                      <span className="text-[11px] text-text-muted">
                        {post.publishedAt}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-text truncate">
                    {post.title}
                  </h4>
                  {post.excerpt && (
                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                </div>

                {isSelected && (
                  <CornerDownLeft className="w-4 h-4 text-primary shrink-0 self-center hidden sm:block" />
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-text-muted text-xs">
              {t("noPostsFoundQuery", { query })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-surface-hover/30 flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono">
                ↑
              </kbd>{" "}
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono">
                ↓
              </kbd>{" "}
              {t("navigate")}
            </span>
            <span>
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono">
                ↵
              </kbd>{" "}
              {t("open")}
            </span>
          </div>
          <span>
            <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono">
              ESC
            </kbd>{" "}
            {t("close")}
          </span>
        </div>
      </div>
    </div>
  );
}
