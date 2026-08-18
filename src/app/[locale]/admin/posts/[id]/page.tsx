import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { posts, postCategories, postTags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCategories } from "@/actions/categories";
import { getTags } from "@/actions/tags";
import { PostEditor } from "@/components/admin/PostEditor";
import { notFound } from "next/navigation";

/**
 * Page for editing an existing blog article.
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const post = db.select().from(posts).where(and(eq(posts.id, id), eq(posts.siteId, site.id))).get();
  if (!post) notFound();

  const assignedCatIds = db
    .select({ id: postCategories.categoryId })
    .from(postCategories)
    .where(eq(postCategories.postId, id))
    .all()
    .map((c) => c.id);

  const assignedTagIds = db
    .select({ id: postTags.tagId })
    .from(postTags)
    .where(eq(postTags.postId, id))
    .all()
    .map((t) => t.id);

  const categories = await getCategories(site.id);
  const tags = await getTags(site.id);

  return (
    <PostEditor
      siteId={site.id}
      initialPost={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        contentMd: post.contentMd || "",
        excerpt: post.excerpt || "",
        coverImage: post.coverImage,
        status: post.status,
        locale: post.locale,
        pinned: post.pinned,
        categories: assignedCatIds,
        tags: assignedTagIds,
      }}
      availableCategories={categories}
      availableTags={tags}
    />
  );
}
