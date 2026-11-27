import { getAdminSite } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth/session";
import { getAdminEditablePost } from "@/lib/queries/admin-dashboard";
import { getCategories } from "@/actions/categories";
import { getTags } from "@/actions/tags";
import { PostEditor } from "@/components/admin/PostEditor";
import { isDubConfigured } from "@/lib/dub";
import { ROLES } from "@/lib/config/constants";
import { notFound } from "next/navigation";

/**
 * Server page component loading an existing post by identifier and initializing the WYSIWYG editor with its contents.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ id: string }>} props.params - Promise resolving to route parameters with the target post database ID.
 * @returns {Promise<React.JSX.Element>} React JSX post editor view.
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getAdminSite();
  if (!site) notFound();

  const user = await getCurrentUser();

  const editable = getAdminEditablePost(site.id, id);
  if (!editable) notFound();
  const { post, assignedCatIds, assignedTagIds } = editable;

  const categories = await getCategories(site.id);
  const tags = await getTags(site.id);

  let supportedLocales = ["es", "en"];
  if (site.supportedLocales) {
    try {
      const parsed = JSON.parse(site.supportedLocales);
      if (Array.isArray(parsed) && parsed.length > 0) supportedLocales = parsed;
    } catch {}
  }

  return (
    <PostEditor
      siteId={site.id}
      supportedLocales={supportedLocales}
      isDubEnabled={isDubConfigured()}
      canPin={user?.role !== ROLES.AUTHOR}
      initialPost={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content || "",
        contentMd: post.contentMd || "",
        contentHtml: post.contentHtml || "",
        contentFormat: post.contentFormat,
        excerpt: post.excerpt || "",
        coverImage: post.coverImage,
        status: post.status,
        publishedAt: post.publishedAt,
        locale: post.locale,
        pinned: post.pinned,
        shortUrl: post.shortUrl,
        categories: assignedCatIds,
        tags: assignedTagIds,
      }}
      availableCategories={categories}
      availableTags={tags}
    />
  );
}
