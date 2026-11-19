import { getDb } from "@/lib/db";
import { posts, users, categories, tags, postCategories, postTags } from "@/lib/db/schema";
import { and, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { getPublicPostCondition } from "@/lib/db/scheduled";

export interface TaxonomySummary {
  id: string;
  name: string;
  slug: string;
}

export interface HydratedPublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string | null;
  contentMd: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  views: number;
  pinned: boolean;
  authorName: string | null;
  authorAvatar: string | null;
  categories: TaxonomySummary[];
  tags: TaxonomySummary[];
}

export interface PaginatedPostsResult {
  items: HydratedPublicPost[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Normalizes a `?page=` query string into a valid 1-based page index.
 *
 * @param rawPage - Raw query string value.
 * @returns Positive integer >= 1.
 */
export function parsePageNumber(rawPage?: string | string[] | null): number {
  const single = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const parsed = Number.parseInt(single || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Batch-hydrates categories and tags for a list of post IDs in two queries instead of
 * executing N+1 per-post relational queries during feed rendering.
 *
 * @param rawPosts - Post rows selected from SQLite.
 * @returns Post items enriched with `categories` and `tags` arrays.
 */
function hydratePostsWithTaxonomies<T extends { id: string }>(
  rawPosts: T[]
): Array<T & { categories: TaxonomySummary[]; tags: TaxonomySummary[] }> {
  if (rawPosts.length === 0) return [];

  const db = getDb();
  const postIds = rawPosts.map((p) => p.id);

  const catRows = db
    .select({
      postId: postCategories.postId,
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(inArray(postCategories.postId, postIds))
    .all();

  const tagRows = db
    .select({
      postId: postTags.postId,
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds))
    .all();

  const catsByPost = new Map<string, TaxonomySummary[]>();
  for (const row of catRows) {
    const existing = catsByPost.get(row.postId);
    const entry = { id: row.id, name: row.name, slug: row.slug };
    if (existing) existing.push(entry);
    else catsByPost.set(row.postId, [entry]);
  }

  const tagsByPost = new Map<string, TaxonomySummary[]>();
  for (const row of tagRows) {
    const existing = tagsByPost.get(row.postId);
    const entry = { id: row.id, name: row.name, slug: row.slug };
    if (existing) existing.push(entry);
    else tagsByPost.set(row.postId, [entry]);
  }

  return rawPosts.map((p) => ({
    ...p,
    categories: catsByPost.get(p.id) || [],
    tags: tagsByPost.get(p.id) || [],
  }));
}

/**
 * Fetches server-paginated public blog posts for a site, optionally filtered by a category or tag.
 *
 * @param options - Site ID, optional taxonomy filter, page number, and page size.
 * @returns Paginated items and metadata.
 */
export function getPaginatedPublicPosts(options: {
  siteId: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  tagId?: string;
}): PaginatedPostsResult {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 5, 50));
  const requestedPage = Math.max(1, options.page ?? 1);

  const baseCondition: SQL = and(eq(posts.siteId, options.siteId), getPublicPostCondition())!;

  let totalCount = 0;
  let totalPages = 1;
  let currentPage = requestedPage;
  let rawRows: Array<Omit<HydratedPublicPost, "categories" | "tags">> = [];

  if (options.categoryId) {
    const cond = and(eq(postCategories.categoryId, options.categoryId), baseCondition);
    totalCount =
      db
        .select({ total: count() })
        .from(postCategories)
        .innerJoin(posts, eq(postCategories.postId, posts.id))
        .where(cond)
        .get()?.total ?? 0;

    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    rawRows = db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        contentHtml: posts.contentHtml,
        contentMd: posts.contentMd,
        coverImage: posts.coverImage,
        publishedAt: posts.publishedAt,
        views: posts.views,
        pinned: posts.pinned,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(postCategories)
      .innerJoin(posts, eq(postCategories.postId, posts.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(cond)
      .orderBy(desc(posts.pinned), desc(posts.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();
  } else if (options.tagId) {
    const cond = and(eq(postTags.tagId, options.tagId), baseCondition);
    totalCount =
      db
        .select({ total: count() })
        .from(postTags)
        .innerJoin(posts, eq(postTags.postId, posts.id))
        .where(cond)
        .get()?.total ?? 0;

    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    rawRows = db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        contentHtml: posts.contentHtml,
        contentMd: posts.contentMd,
        coverImage: posts.coverImage,
        publishedAt: posts.publishedAt,
        views: posts.views,
        pinned: posts.pinned,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(postTags)
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(cond)
      .orderBy(desc(posts.pinned), desc(posts.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();
  } else {
    totalCount = db.select({ total: count() }).from(posts).where(baseCondition).get()?.total ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    rawRows = db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        contentHtml: posts.contentHtml,
        contentMd: posts.contentMd,
        coverImage: posts.coverImage,
        publishedAt: posts.publishedAt,
        views: posts.views,
        pinned: posts.pinned,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(baseCondition)
      .orderBy(desc(posts.pinned), desc(posts.publishedAt))
      .limit(pageSize)
      .offset(offset)
      .all();
  }

  return {
    items: hydratePostsWithTaxonomies(rawRows),
    totalCount,
    totalPages,
    currentPage,
  };
}

/**
 * Queries the latest published post summaries for the sidebar recent-entries block.
 *
 * @param siteId - Tenant site identifier.
 * @param limit - Maximum entries (defaults to 5).
 */
export function getLatestPublicPostsSummary(siteId: string, limit = 5) {
  const db = getDb();
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), getPublicPostCondition()))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .all();
}

/**
 * Performs tenant-scoped SQLite keyword search over published article titles, excerpts, and slugs.
 *
 * @param siteId - Tenant site identifier.
 * @param query - User search keyword string.
 * @param limit - Maximum matching articles returned.
 */
export function searchPublicPosts(siteId: string, query: string, limit = 20) {
  const db = getDb();
  const clean = query.trim().slice(0, 100);
  const baseCond = and(eq(posts.siteId, siteId), getPublicPostCondition());

  if (!clean) {
    return db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
      })
      .from(posts)
      .where(baseCond)
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .all();
  }

  const pattern = `%${clean}%`;
  return db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
    })
    .from(posts)
    .where(
      and(
        baseCond,
        or(like(posts.title, pattern), like(posts.excerpt, pattern), like(posts.slug, pattern))
      )
    )
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .all();
}
