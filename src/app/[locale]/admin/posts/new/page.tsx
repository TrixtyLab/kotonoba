import { getAdminSite } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth/session";
import { getCategories } from "@/actions/categories";
import { getTags } from "@/actions/tags";
import { PostEditor } from "@/components/admin/PostEditor";
import { isDubConfigured } from "@/lib/dub";
import { ROLES } from "@/lib/config/constants";
import { notFound } from "next/navigation";

/**
 * Server page component initializing the WYSIWYG editor for composing a new blog post.
 *
 * @returns React JSX new post editor workspace.
 */
export default async function NewPostPage() {
  const site = await getAdminSite();
  if (!site) notFound();

  const user = await getCurrentUser();

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
      availableCategories={categories}
      availableTags={tags}
    />
  );
}
