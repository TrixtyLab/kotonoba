"use client";

import React, { useEffect, useState, useRef } from "react";
import { List } from "lucide-react";
import { useTranslations } from "next-intl";

/** Structure of an extracted heading entry within the table of contents. */
interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Sticky table of contents component automatically extracting H2-H4 headings from article HTML with active section highlighting.
 *
 * @param props - Object containing the raw article content HTML string.
 * @returns React JSX table of contents component or null when fewer than 2 headings exist.
 */
export function TableOfContents({ contentHtml }: { contentHtml: string }) {
  const t = useTranslations("blog");
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headingRegex = /<h([2-4])\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[2-4]>/gi;
    const parsed: TocItem[] = [];
    let match;
    while ((match = headingRegex.exec(contentHtml)) !== null) {
      const text = match[3].replace(/<[^>]+>/g, "").trim();
      if (text) {
        parsed.push({ id: match[2], text, level: Number(match[1]) });
      }
    }
    setItems(parsed);
  }, [contentHtml]);

  useEffect(() => {
    if (items.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0.1 }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <div className="card-clean p-5 sticky top-20 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-text pb-3 border-b border-border">
        <List className="w-4 h-4 text-primary" />
        <span>{t("tableOfContents")}</span>
      </div>

      <nav className="space-y-1 text-xs">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`block py-1.5 transition-colors leading-relaxed ${
                item.level === 3 ? "pl-4" : item.level === 4 ? "pl-8" : "pl-0"
              } ${
                isActive
                  ? "text-primary font-semibold border-l-2 border-primary pl-2"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {item.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
