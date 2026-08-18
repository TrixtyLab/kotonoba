"use client";

import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Parses article headers to build a sticky interactive Table of Contents with active scrollspy highlights.
 */
export function TableOfContents({ contentHtml }: { contentHtml: string }) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const doc = new DOMParser().parseFromString(contentHtml, "text/html");
    const elements = doc.querySelectorAll("h1, h2, h3");
    const items: HeadingItem[] = [];

    elements.forEach((el, index) => {
      const text = el.textContent || "";
      const level = parseInt(el.tagName.replace("H", ""), 10);
      const id = el.id || `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      items.push({ id, text, level });
    });

    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -70% 0px" }
    );

    document.querySelectorAll("article h1, article h2, article h3").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [contentHtml]);

  if (headings.length < 2) return null;

  return (
    <nav className="glass p-4 rounded-xl space-y-2.5 border border-border sticky top-24">
      <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-text font-semibold text-xs uppercase tracking-wider">
        <ListTree className="w-3.5 h-3.5 text-primary" />
        <span>Table of Contents</span>
      </div>
      <ul className="space-y-1.5 text-xs">
        {headings.map((h) => (
          <li
            key={h.id}
            style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
            className="truncate"
          >
            <a
              href={`#${h.id}`}
              className={`block truncate transition-colors ${
                activeId === h.id
                  ? "text-primary font-semibold"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
