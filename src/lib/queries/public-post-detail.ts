import { getDb } from "@/lib/db";
import { posts, users, categories, tags, postCategories, postTags } from "@/lib/db/schema";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { getPublicPostCondition } from "@/lib/db/scheduled";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";
import type { TaxonomySummary } from "@/lib/queries/taxonomy";

interface PublicSinglePostBundle {
  post: {
    id: string;
    title: string;
    slug: string;
    content: string | null;
    contentMd: string | null;
    contentHtml: string | null;
    contentFormat: "html" | "markdown" | null;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    views: number;
    shortUrl: string | null;
    authorName: string | null;
    authorAvatar: string | null;
  };
  assignedCategories: TaxonomySummary[];
  assignedTags: TaxonomySummary[];
  prevPost: { title: string; slug: string } | null;
  nextPost: { title: string; slug: string } | null;
}

function hydrateNullableDate(val: Date | string | null): Date | null {
  if (!val) return null;
  return val instanceof Date ? val : new Date(val);
}

/** Tenant-cached single published article query with taxonomies and sequential prev/next navigation. */
export async function getCachedPublicPostBySlug(
  siteId: string,
  slug: string,
  locale = "en",
  host = "default"
): Promise<PublicSinglePostBundle | null> {
  const bundle = await runWithTenantCache(
    async (): Promise<PublicSinglePostBundle | null> => {
      const db = getDb();
      const post = db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          content: posts.content,
          contentMd: posts.contentMd,
          contentHtml: posts.contentHtml,
          contentFormat: posts.contentFormat,
          excerpt: posts.excerpt,
          coverImage: posts.coverImage,
          publishedAt: posts.publishedAt,
          views: posts.views,
          shortUrl: posts.shortUrl,
          authorName: users.displayName,
          authorAvatar: users.avatarUrl,
        })
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(and(eq(posts.siteId, siteId), eq(posts.slug, slug), getPublicPostCondition()))
        .get();

      if (!post) return null;

      const assignedCategories = db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(postCategories)
        .innerJoin(categories, eq(postCategories.categoryId, categories.id))
        .where(eq(postCategories.postId, post.id))
        .all();

      const assignedTags = db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, post.id))
        .all();

      const prevPost = post.publishedAt
        ? db
            .select({ title: posts.title, slug: posts.slug })
            .from(posts)
            .where(and(eq(posts.siteId, siteId), getPublicPostCondition(), lt(posts.publishedAt, post.publishedAt)))
            .orderBy(desc(posts.publishedAt))
            .limit(1)
            .get() || null
        : null;

      const nextPost = post.publishedAt
        ? db
            .select({ title: posts.title, slug: posts.slug })
            .from(posts)
            .where(and(eq(posts.siteId, siteId), getPublicPostCondition(), gt(posts.publishedAt, post.publishedAt)))
            .orderBy(asc(posts.publishedAt))
            .limit(1)
            .get() || null
        : null;

      return { post, assignedCategories, assignedTags, prevPost, nextPost };
    },
    ["public-post-by-slug", siteId, host, locale, slug],
    { tags: [sitePostsCacheTag(siteId)], revalidate: 60 }
  );

  if (!bundle) return null;
  return {
    ...bundle,
    post: {
      ...bundle.post,
      publishedAt: hydrateNullableDate(bundle.post.publishedAt),
    },
  };
}
