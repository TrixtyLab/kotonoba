import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/Badge";
import { Calendar, Clock, Eye, Pin } from "lucide-react";

export interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt: Date | null;
    views?: number;
    pinned?: boolean;
    authorName?: string | null;
    categories?: Array<{ id: string; name: string; slug: string }>;
  };
  featured?: boolean;
  locale?: string;
}

/**
 * Responsive article card supporting featured hero banner layout and standard card grids.
 */
export function PostCard({ post, featured = false, locale = "en" }: PostCardProps) {
  const readTime = Math.max(1, Math.ceil((post.excerpt?.length || 500) / 300));
  const postUrl = `/entry/${post.slug}`;

  if (featured) {
    return (
      <article className="glass rounded-xl overflow-hidden border border-border group card-hover">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {post.coverImage && (
            <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-full min-h-[260px] overflow-hidden">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                {post.pinned && (
                  <Badge variant="primary" className="bg-primary text-white font-semibold">
                    <Pin className="w-3 h-3 mr-1" /> Featured
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className={`${post.coverImage ? "lg:col-span-5" : "lg:col-span-12"} p-6 sm:p-8 flex flex-col justify-between space-y-4`}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {post.categories?.map((c) => (
                  <Badge key={c.id} variant="secondary">
                    {c.name}
                  </Badge>
                ))}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-text group-hover:text-primary transition-colors leading-snug">
                <Link href={postUrl}>{post.title}</Link>
              </h2>

              {post.excerpt && (
                <p className="text-sm text-text-muted line-clamp-3 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted pt-4 border-t border-border/50">
              <div className="flex items-center gap-3">
                {post.publishedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(post.publishedAt, locale)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {readTime} min read
                </span>
              </div>
              <Link href={postUrl} className="font-semibold text-primary hover:underline">
                Read Article →
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass rounded-xl overflow-hidden border border-border flex flex-col justify-between group card-hover h-full">
      <div>
        {post.coverImage && (
          <Link href={postUrl} className="block relative h-48 overflow-hidden">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {post.pinned && (
              <div className="absolute top-3 left-3">
                <Badge variant="primary" className="bg-primary text-white font-semibold text-[10px]">
                  <Pin className="w-2.5 h-2.5 mr-1" /> Featured
                </Badge>
              </div>
            )}
          </Link>
        )}

        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {post.categories?.slice(0, 2).map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.name}
              </Badge>
            ))}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-text group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            <Link href={postUrl}>{post.title}</Link>
          </h3>

          {post.excerpt && (
            <p className="text-xs sm:text-sm text-text-muted line-clamp-2 leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-text-muted mt-auto">
        <div className="flex items-center gap-2">
          {post.publishedAt && <span>{formatDate(post.publishedAt, locale)}</span>}
          <span>•</span>
          <span>{readTime}m read</span>
        </div>
        {post.views !== undefined && post.views > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Eye className="w-3 h-3" />
            {post.views}
          </span>
        )}
      </div>
    </article>
  );
}
