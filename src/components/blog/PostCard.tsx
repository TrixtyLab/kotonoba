import React from "react";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { LikeButton } from "@/components/blog/LikeButton";
import { Tag, Eye } from "lucide-react";

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
    <article className="group space-y-4 pb-14 border-b border-border/70 last:border-b-0">
      {post.coverImage && (
        <div className="pb-1">
          <Link href={postUrl} className="block overflow-hidden rounded-xl">
            <img
              src={post.coverImage}
              alt={post.title}
              className="max-w-full h-auto object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
            />
          </Link>
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl font-bold text-text tracking-tight leading-snug">
        <Link href={postUrl} className="group-hover:text-primary hover:text-primary transition-colors">
          {post.title}
        </Link>
      </h2>

      {/* Date & Categories */}
      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
        {post.publishedAt && (
          <time dateTime={typeof post.publishedAt === "string" ? post.publishedAt : post.publishedAt.toISOString()}>
            {formatDate(post.publishedAt, locale)}
          </time>
        )}

        {post.categories && post.categories.length > 0 && (
          <>
            <span>•</span>
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

      {post.excerpt && (
        <div className="text-[15.5px] text-text leading-[2.1] space-y-4 pt-1">
          <p>{post.excerpt}</p>
        </div>
      )}

      <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-text-muted">
        <div className="flex items-center gap-4">
          <LikeButton postId={post.id} initialLikes={Math.floor((post.views || 0) / 8)} />

          {post.views !== undefined && post.views > 0 && (
            <span className="flex items-center gap-1 font-mono text-xs text-text-muted tabular-nums">
              <Eye className="w-3.5 h-3.5" />
              {post.views}
            </span>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-text-muted shrink-0" />
            {post.tags.map((t) => (
              <Link
                key={t.id}
                href={`/tag/${t.slug}`}
                className="hover:text-primary transition-colors"
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
