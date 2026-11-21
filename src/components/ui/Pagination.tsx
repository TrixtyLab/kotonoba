"use client";

import React from "react";
import { Link } from "@/i18n/routing";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
}

type PaginationToken = number | "ellipsis-left" | "ellipsis-right";

function buildPageWindow(currentPage: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  const tokens: PaginationToken[] = [1];

  if (start > 3) tokens.push("ellipsis-left");
  else if (start === 3) tokens.push(2);

  for (let page = start; page <= end; page++) {
    tokens.push(page);
  }

  if (end < totalPages - 2) tokens.push("ellipsis-right");
  else if (end === totalPages - 2) tokens.push(totalPages - 1);

  tokens.push(totalPages);
  return tokens;
}

/**
 * Windowed accessible pagination landmark with semantic `rel="prev"` / `rel="next"` links.
 */
export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  ariaLabel,
  previousLabel,
  nextLabel,
}: PaginationProps): React.JSX.Element | null {
  if (totalPages <= 1) return null;

  const tokens = buildPageWindow(currentPage, totalPages);

  return (
    <nav aria-label={ariaLabel} className="flex items-center justify-center gap-2 py-8 flex-wrap">
      {currentPage > 1 && (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          {previousLabel}
        </Link>
      )}

      {tokens.map((token) => {
        if (typeof token !== "number") {
          return (
            <span
              key={token}
              aria-hidden="true"
              className="w-8 h-8 flex items-center justify-center text-xs text-text-muted select-none"
            >
              …
            </span>
          );
        }

        const isActive = token === currentPage;
        return (
          <Link
            key={token}
            href={buildHref(token)}
            aria-current={isActive ? "page" : undefined}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${
              isActive
                ? "bg-accent text-white shadow-xs"
                : "border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            {token}
          </Link>
        );
      })}

      {currentPage < totalPages && (
        <Link
          href={buildHref(currentPage + 1)}
          rel="next"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          {nextLabel}
        </Link>
      )}
    </nav>
  );
}
