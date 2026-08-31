import React from "react";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { LikeButton } from "@/components/blog/LikeButton";
import { Pin, Eye } from "lucide-react";

/**
 * Properties configuring the PostCard feed article component.
 */
export interface PostCardProps {
  /** Post data object. */
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    contentHtml?: string | null;
    contentMd?: string | null;
    coverImage?: string | null;
    publishedAt: Date | null;
    views?: number;
    pinned?: boolean;
    authorName?: string | null;
    authorAvatar?: string | null;
    categories?: Array<{ id: string; name: string; slug: string }>;
    tags?: Array<{ id: string; name: string; slug: string }>;
  };
  /** Optional featured highlight flag. */
  featured?: boolean;
  /** Active language code. */
  locale?: string;
}

/**
 * Clean blog feed article card rendering article headline, publication date, cover media image, excerpt, reaction counters, and taxonomy tags.
 *
 * @param props - PostCardProps configuring post attributes and locale.
 * @returns React JSX article entry element.
 */
export function PostCard({ post, locale = "en" }: PostCardProps) {
  const postUrl = `/entry/${post.slug}`;

  return (
    <article className="group space-y-3 pb-8 border-b border-border/40 last:border-b-0">
      {post.coverImage && (
        <Link href={postUrl} className="block overflow-hidden rounded-lg aspect-2/1 sm:aspect-16/9 bg-surface-hover/30 mb-4">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      )}

      {/* Metadata: Date, Categories, Pinned */}
      <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
        {post.pinned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent uppercase tracking-wider">
            <Pin className="w-3 h-3 rotate-45" />
            <span>Featured</span>
            <span className="text-text-muted/40">•</span>
          </span>
        )}

        {post.publishedAt && (
          <time dateTime={typeof post.publishedAt === "string" ? post.publishedAt : post.publishedAt.toISOString()}>
            {formatDate(post.publishedAt, locale)}
          </time>
        )}

        {post.categories && post.categories.length > 0 && (
          <>
            <span className="text-text-muted/40">•</span>
            <div className="flex items-center gap-2 flex-wrap">
              {post.categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  className="font-medium text-accent hover:underline transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Headline */}
      <h2 className="text-xl sm:text-2xl font-bold text-text tracking-tight leading-snug">
        <Link href={postUrl} className="group-hover:text-accent transition-colors">
          {post.title}
        </Link>
      </h2>

      {/* Excerpt Body (Clickable to post) */}
      {post.excerpt && (
        <Link
          href={postUrl}
          className="block text-sm sm:text-[15px] text-text-muted/90 leading-relaxed line-clamp-3 hover:text-text transition-colors"
        >
          {post.excerpt}
        </Link>
      )}

      {/* Footer bar: LikeButton, Views, Tags */}
      <div className="pt-2 flex items-center justify-between gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-3">
          <LikeButton postId={post.id} initialLikes={Math.floor((post.views || 0) / 8)} />
          {post.views !== undefined && post.views > 0 && (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-muted tabular-nums">
              <Eye className="w-3.5 h-3.5 text-text-muted/70" />
              <span>{post.views}</span>
            </span>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {post.tags.map((t) => (
              <Link
                key={t.id}
                href={`/tag/${t.slug}`}
                className="text-[11px] text-text-muted hover:text-accent transition-colors"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
