"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/ui/Pagination";

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

function buildPageHref(baseUrl: string, page: number): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}page=${page}`;
}

/**
 * Windowed, localized pagination navigation bar backed by {@link Pagination} with `rel="prev"` / `rel="next"`.
 */
export function LinePagination({
  currentPage = 1,
  totalPages = 1,
  baseUrl = "/",
}: LinePaginationProps) {
  const t = useTranslations("common");

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      buildHref={(page) => buildPageHref(baseUrl, page)}
      ariaLabel={t("paginationLabel")}
      previousLabel={t("previous")}
      nextLabel={t("next")}
    />
  );
}
