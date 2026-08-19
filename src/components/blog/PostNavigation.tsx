import React from "react";
import { Link } from "@/i18n/routing";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Basic post reference for sequential navigation.
 */
export interface NavPost {
  /** Post title. */
  title: string;
  /** Post URL slug. */
  slug: string;
}

/**
 * Sequential article navigation footer linking readers to adjacent previous and next published posts.
 *
 * @param props - Object containing optional previous and next NavPost references.
 * @returns React JSX navigation grid or null if neither adjacent post exists.
 */
export function PostNavigation({
  prevPost,
  nextPost,
}: {
  prevPost?: NavPost | null;
  nextPost?: NavPost | null;
}) {
  if (!prevPost && !nextPost) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 mt-8 border-t border-border">
      {prevPost ? (
        <Link
          href={`/entry/${prevPost.slug}`}
          className="card-clean p-4 flex items-center gap-3 group hover:border-primary/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] text-text-muted font-medium block">
              Anterior
            </span>
            <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors truncate block">
              {prevPost.title}
            </span>
          </div>
        </Link>
      ) : (
        <div className="hidden sm:block" />
      )}

      {nextPost && (
        <Link
          href={`/entry/${nextPost.slug}`}
          className="card-clean p-4 flex items-center justify-end gap-3 text-right group hover:border-primary/50 transition-colors"
        >
          <div className="min-w-0">
            <span className="text-[11px] text-text-muted font-medium block">
              Siguiente
            </span>
            <span className="text-sm font-semibold text-text group-hover:text-primary transition-colors truncate block">
              {nextPost.title}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors shrink-0" />
        </Link>
      )}
    </div>
  );
}
