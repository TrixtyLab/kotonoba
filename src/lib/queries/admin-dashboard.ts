import { getDb } from "@/lib/db";
import {
  analytics,
  categories,
  pages,
  postCategories,
  posts,
  postTags,
  users,
} from "@/lib/db/schema";
import { POST_STATUS } from "@/lib/config/constants";
import { and, desc, eq, sql } from "drizzle-orm";

/** Aggregates KPI totals and recent article list for the main `/admin` dashboard. */
export function getAdminDashboardOverview(siteId: string) {
  const db = getDb();

  const postStats = db
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when ${posts.status} = ${POST_STATUS.PUBLISHED} then 1 else 0 end)`,
      drafts: sql<number>`sum(case when ${posts.status} = ${POST_STATUS.DRAFT} then 1 else 0 end)`,
      totalViews: sql<number>`sum(views)`,
    })
    .from(posts)
    .where(eq(posts.siteId, siteId))
    .get();

  const pageStats = db
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`sum(case when ${pages.status} = ${POST_STATUS.PUBLISHED} then 1 else 0 end)`,
      drafts: sql<number>`sum(case when ${pages.status} = ${POST_STATUS.DRAFT} then 1 else 0 end)`,
      totalViews: sql<number>`sum(views)`,
    })
    .from(pages)
    .where(eq(pages.siteId, siteId))
    .get();

  const categoryCount = db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
    .where(eq(categories.siteId, siteId))
    .get();

  const recentPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      views: posts.views,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      coverImage: posts.coverImage,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.siteId, siteId))
    .orderBy(desc(posts.createdAt))
    .limit(5)
    .all();

  const totalHits = db
    .select({ count: sql<number>`count(*)` })
    .from(analytics)
    .where(eq(analytics.siteId, siteId))
    .get();

  return { postStats, pageStats, categoryCount, recentPosts, totalHits };
}

/** Loads a tenant-scoped blog article and its assigned taxonomy IDs for the admin editor. */
export function getAdminEditablePost(siteId: string, postId: string) {
  const db = getDb();
  const post = db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.siteId, siteId)))
    .get();
  if (!post) return null;

  const assignedCatIds = db
    .select({ id: postCategories.categoryId })
    .from(postCategories)
    .where(eq(postCategories.postId, postId))
    .all()
    .map((c) => c.id);

  const assignedTagIds = db
    .select({ id: postTags.tagId })
    .from(postTags)
    .where(eq(postTags.postId, postId))
    .all()
    .map((t) => t.id);

  return { post, assignedCatIds, assignedTagIds };
}

/** Loads a tenant-scoped custom static page for the admin editor. */
export function getAdminEditablePage(siteId: string, pageId: string) {
  return (
    getDb()
      .select()
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
      .get() || null
  );
}
