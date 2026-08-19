import { getActiveSite } from "@/lib/tenant";
import { getAdminPosts } from "@/actions/posts";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { PostsListClient } from "@/components/admin/PostsListClient";

/**
 * Server page component loading and rendering the administrative posts management table for the active blog site.
 *
 * @param props - Object containing route params Promise with active locale.
 * @returns React JSX posts list view.
 */
export default async function AdminPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const site = await getActiveSite();
  const rawPosts = site ? await getAdminPosts(site.id) : [];

  const postList = rawPosts.map((p) => ({
    ...p,
    publishedAtFormatted: p.publishedAt ? formatDate(p.publishedAt, locale) : null,
    createdAtFormatted: formatDate(p.createdAt, locale),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Articles</h1>
          <p className="text-xs text-text-muted">Manage, filter, and publish content for this blog</p>
        </div>

        <Link href="/admin/posts/new">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            New Article
          </Button>
        </Link>
      </div>

      <PostsListClient initialPosts={postList} />
    </div>
  );
}
