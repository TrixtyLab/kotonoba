import { getActiveSite } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { getTags } from "@/actions/tags";
import { PostEditor } from "@/components/admin/PostEditor";
import { notFound } from "next/navigation";

/**
 * Page for composing a new blog post with Tiptap editor and Mermaid diagrams.
 */
export default async function NewPostPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const categories = await getCategories(site.id);
  const tags = await getTags(site.id);

  return (
    <PostEditor
      siteId={site.id}
      availableCategories={categories}
      availableTags={tags}
    />
  );
}
