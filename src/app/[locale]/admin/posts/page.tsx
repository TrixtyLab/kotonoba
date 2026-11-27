import { getAdminSite } from "@/lib/tenant";
import { getAdminPosts } from "@/actions/posts";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils/date";
import { PostsListClient } from "@/components/admin/PostsListClient";

/**
 * Server page component loading and rendering the administrative posts management table for the active blog site.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving to route parameters with active locale code.
 * @returns {Promise<React.JSX.Element>} React JSX posts list view.
 */
export default async function AdminPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [site, user] = await Promise.all([getAdminSite(), getCurrentUser()]);
  const rawPosts = site ? await getAdminPosts(site.id) : [];
  const viewer = { id: user?.userId ?? "", role: user?.role ?? "author" };

  const postList = rawPosts.map((p) => ({
    ...p,
    publishedAtFormatted: p.publishedAt ? formatDate(p.publishedAt, locale) : null,
    createdAtFormatted: formatDate(p.createdAt, locale),
  }));

  return <PostsListClient initialPosts={postList} viewer={viewer} />;
}
