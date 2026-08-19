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
    <div className="flex items-center justify-center gap-1.5 py-10">
      {pages.map((p) => {
        const isActive = p === currentPage;
        return (
          <Link
            key={p}
            href={`${baseUrl}?page=${p}`}
            className={`w-8 h-8 flex items-center justify-center text-xs font-semibold transition-colors ${
              isActive
                ? "bg-[#2563eb] text-white"
                : "border border-border bg-surface text-text hover:bg-surface-hover"
            }`}
          >
            {p}
          </Link>
        );
      })}

      {currentPage < totalPages && (
        <Link
          href={`${baseUrl}?page=${currentPage + 1}`}
          className="w-8 h-8 flex items-center justify-center text-xs border border-border bg-surface text-text hover:bg-surface-hover transition-colors"
          aria-label="Next page"
        >
          ›
        </Link>
      )}
    </div>
  );
}
