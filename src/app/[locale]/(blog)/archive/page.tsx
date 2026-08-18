import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils/date";
import { Link } from "@/i18n/routing";
import { Calendar, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getActiveSite();
  return {
    title: `Archive — ${site?.name || "Blog"}`,
    description: "Chronological history of all published articles",
  };
}

/**
 * Chronological archive page grouping articles by publication year.
 */
export default async function ArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  const db = getDb();

  const allPosts = site
    ? db
        .select()
        .from(posts)
        .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
        .orderBy(desc(posts.publishedAt))
        .all()
    : [];

  const groupedByYear: Record<string, typeof allPosts> = {};
  for (const post of allPosts) {
    const year = post.publishedAt ? post.publishedAt.getFullYear().toString() : "Undated";
    if (!groupedByYear[year]) groupedByYear[year] = [];
    groupedByYear[year].push(post);
  }

  const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all articles
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-text">Article Archive</h1>
        <p className="text-sm text-text-muted">Chronological timeline of all published content.</p>
      </div>

      <div className="space-y-10 pt-4">
        {years.map((year) => (
          <section key={year} className="space-y-4">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2 pb-2 border-b border-border">
              <Calendar className="w-5 h-5" />
              <span>{year}</span>
            </h2>
            <ul className="divide-y divide-border/40">
              {groupedByYear[year].map((post) => (
                <li key={post.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 group">
                  <Link
                    href={`/entry/${post.slug}`}
                    className="text-sm font-semibold text-text group-hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                  {post.publishedAt && (
                    <span className="text-xs text-text-muted shrink-0 font-mono">
                      {formatDate(post.publishedAt, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {years.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm">No published articles yet.</div>
        )}
      </div>
    </div>
  );
}
