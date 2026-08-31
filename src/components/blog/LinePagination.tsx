"use client";

import React from "react";
import { Link } from "@/i18n/routing";

/**
 * Properties configuring the LinePagination numbered navigation bar.
 */
export interface LinePaginationProps {
  /** Currently active 1-indexed page number. */
  currentPage?: number;
  /** Total available pages count. */
  totalPages?: number;
  /** Base URL path to prepend before page query params. */
  baseUrl?: string;
}

/**
 * Clean numbered pagination component rendering page number blocks and next page arrows.
 *
 * @param props - LinePaginationProps configuring current page, total pages, and target base URL.
 * @returns React JSX pagination container element or null if total pages is 1 or less.
 */
export function LinePagination({
  currentPage = 1,
  totalPages = 1,
  baseUrl = "/",
}: LinePaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 py-8">
      {currentPage > 1 && (
        <Link
          href={`${baseUrl}?page=${currentPage - 1}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          Previous
        </Link>
      )}

      {pages.map((p) => {
        const isActive = p === currentPage;
        return (
          <Link
            key={p}
            href={`${baseUrl}?page=${p}`}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${
              isActive
                ? "bg-accent text-white shadow-xs"
                : "border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover"
            }`}
          >
            {p}
          </Link>
        );
      })}

      {currentPage < totalPages && (
        <Link
          href={`${baseUrl}?page=${currentPage + 1}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/40 bg-surface/50 text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          Next
        </Link>
      )}
    </div>
  );
}
