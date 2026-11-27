import { getDb } from "@/lib/db";
import { posts, users, categories, tags, postCategories, postTags } from "@/lib/db/schema";
import { and, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { getPublicPostCondition } from "@/lib/db/scheduled";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";
import {
  ARCHIVE_PAGE_SIZE,
  DEFAULT_PUBLIC_PAGE_SIZE,
  MAX_PUBLIC_PAGE_SIZE,
  SEARCH_PAGE_LIMIT,
} from "@/lib/config/constants";
import type { TaxonomySummary } from "@/lib/queries/taxonomy";

export interface HydratedPublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
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

export interface ArchivePostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  views: number;
}

export interface PaginatedArchiveResult {
  items: ArchivePostItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface PublicSearchPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
}

export interface PaginatedSearchResult {
  items: PublicSearchPostItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

/** Normalizes a `?page=` query string into a valid 1-based page index. */
export function parsePageNumber(rawPage?: string | string[] | null): number {
  const single = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const parsed = Number.parseInt(single || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toDateOrNull(val: Date | string | null): Date | null {
  if (!val) return null;
  return val instanceof Date ? val : new Date(val);
}

function rehydratePublishedDates<T extends { publishedAt: Date | string | null }>(
  items: T[]
): Array<Omit<T, "publishedAt"> & { publishedAt: Date | null }> {
  return items.map((item) => ({
    ...item,
    publishedAt: toDateOrNull(item.publishedAt),
  }));
}

function buildTaxonomyMap(
  rows: Array<{ postId: string; id: string; name: string; slug: string }>
): Map<string, TaxonomySummary[]> {
  const map = new Map<string, TaxonomySummary[]>();
  for (const row of rows) {
    const existing = map.get(row.postId);
    const entry = { id: row.id, name: row.name, slug: row.slug };
    if (existing) existing.push(entry);
    else map.set(row.postId, [entry]);
  }
  return map;
}

function hydratePostsWithTaxonomies<T extends { id: string }>(
  rawPosts: T[]
): Array<T & { categories: TaxonomySummary[]; tags: TaxonomySummary[] }> {
  if (rawPosts.length === 0) return [];
  const db = getDb();
  const postIds = rawPosts.map((p) => p.id);

  const catRows = db
    .select({ postId: postCategories.postId, id: categories.id, name: categories.name, slug: categories.slug })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(inArray(postCategories.postId, postIds))
    .all();

  const tagRows = db
    .select({ postId: postTags.postId, id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds))
    .all();

  const catsByPost = buildTaxonomyMap(catRows);
  const tagsByPost = buildTaxonomyMap(tagRows);

  return rawPosts.map((p) => ({
    ...p,
    categories: catsByPost.get(p.id) || [],
    tags: tagsByPost.get(p.id) || [],
  }));
}

// Listing views render excerpts and metadata only; full bodies are fetched by the
// entry/page detail queries to keep public list payloads bounded.
const PUBLIC_POST_LIST_COLUMNS = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  coverImage: posts.coverImage,
  publishedAt: posts.publishedAt,
  views: posts.views,
  pinned: posts.pinned,
  authorName: users.displayName,
  authorAvatar: users.avatarUrl,
};

/** Fetches server-paginated public blog posts for a site, optionally filtered by a category or tag. */
export function getPaginatedPublicPosts(options: {
  siteId: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  tagId?: string;
}): PaginatedPostsResult {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(options.pageSize ?? DEFAULT_PUBLIC_PAGE_SIZE, MAX_PUBLIC_PAGE_SIZE));
  const requestedPage = Math.max(1, options.page ?? 1);
  const baseCondition: SQL = and(eq(posts.siteId, options.siteId), getPublicPostCondition())!;

  let totalCount = 0;
  let cond: SQL | undefined = baseCondition;

  if (options.categoryId) {
    cond = and(eq(postCategories.categoryId, options.categoryId), baseCondition);
    totalCount =
      db.select({ total: count() }).from(postCategories).innerJoin(posts, eq(postCategories.postId, posts.id)).where(cond).get()?.total ?? 0;
  } else if (options.tagId) {
    cond = and(eq(postTags.tagId, options.tagId), baseCondition);
    totalCount =
      db.select({ total: count() }).from(postTags).innerJoin(posts, eq(postTags.postId, posts.id)).where(cond).get()?.total ?? 0;
  } else {
    totalCount = db.select({ total: count() }).from(posts).where(baseCondition).get()?.total ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const rawRows = options.categoryId
    ? db
        .select(PUBLIC_POST_LIST_COLUMNS)
        .from(postCategories)
        .innerJoin(posts, eq(postCategories.postId, posts.id))
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(cond)
        .orderBy(desc(posts.pinned), desc(posts.publishedAt))
        .limit(pageSize)
        .offset(offset)
        .all()
    : options.tagId
    ? db
        .select(PUBLIC_POST_LIST_COLUMNS)
        .from(postTags)
        .innerJoin(posts, eq(postTags.postId, posts.id))
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(cond)
        .orderBy(desc(posts.pinned), desc(posts.publishedAt))
        .limit(pageSize)
        .offset(offset)
        .all()
    : db
        .select(PUBLIC_POST_LIST_COLUMNS)
        .from(posts)
        .leftJoin(users, eq(posts.authorId, users.id))
        .where(baseCondition)
        .orderBy(desc(posts.pinned), desc(posts.publishedAt))
        .limit(pageSize)
        .offset(offset)
        .all();

  return { items: hydratePostsWithTaxonomies(rawRows), totalCount, totalPages, currentPage };
}

/** Queries server-paginated chronological archive summaries scoped to a tenant site. */
export function getPaginatedArchivePosts(options: {
  siteId: string;
  page?: number;
  pageSize?: number;
}): PaginatedArchiveResult {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(options.pageSize ?? ARCHIVE_PAGE_SIZE, MAX_PUBLIC_PAGE_SIZE));
  const requestedPage = Math.max(1, options.page ?? 1);
  const baseCondition: SQL = and(eq(posts.siteId, options.siteId), getPublicPostCondition())!;

  const totalCount = db.select({ total: count() }).from(posts).where(baseCondition).get()?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const items = db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      views: posts.views,
    })
    .from(posts)
    .where(baseCondition)
    .orderBy(desc(posts.publishedAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  return { items, totalCount, totalPages, currentPage };
}

/** Tenant-cached wrapper around `getPaginatedPublicPosts` keyed by `(siteId, host, locale, filters)`. */
export async function getCachedPaginatedPublicPosts(options: {
  siteId: string;
  locale?: string;
  host?: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  tagId?: string;
}): Promise<PaginatedPostsResult> {
  const result = await runWithTenantCache(
    async () => getPaginatedPublicPosts(options),
    [
      "public-posts",
      options.siteId,
      options.host || "default",
      options.locale || "en",
      options.categoryId || "",
      options.tagId || "",
      String(options.page ?? 1),
      String(options.pageSize ?? DEFAULT_PUBLIC_PAGE_SIZE),
    ],
    { tags: [sitePostsCacheTag(options.siteId)], revalidate: 60 }
  );
  return { ...result, items: rehydratePublishedDates(result.items) };
}

/** Tenant-cached wrapper around `getPaginatedArchivePosts` keyed by `(siteId, host, locale, page)`. */
export async function getCachedPaginatedArchivePosts(options: {
  siteId: string;
  locale?: string;
  host?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedArchiveResult> {
  const result = await runWithTenantCache(
    async () => getPaginatedArchivePosts(options),
    [
      "public-archive",
      options.siteId,
      options.host || "default",
      options.locale || "en",
      String(options.page ?? 1),
      String(options.pageSize ?? ARCHIVE_PAGE_SIZE),
    ],
    { tags: [sitePostsCacheTag(options.siteId)], revalidate: 60 }
  );
  return { ...result, items: rehydratePublishedDates(result.items) };
}

/** Tenant-cached latest published post summaries for sidebar and search preload blocks. */
export async function getCachedLatestPublicPostsSummary(
  siteId: string,
  limit = DEFAULT_PUBLIC_PAGE_SIZE,
  locale = "en",
  host = "default"
) {
  const result = await runWithTenantCache(
    async () => {
      const db = getDb();
      return db
        .select({ id: posts.id, title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(eq(posts.siteId, siteId), getPublicPostCondition()))
        .orderBy(desc(posts.publishedAt))
        .limit(limit)
        .all();
    },
    ["latest-public-posts", siteId, host, locale, String(limit)],
    { tags: [sitePostsCacheTag(siteId)], revalidate: 60 }
  );
  return rehydratePublishedDates(result);
}

/** Performs quick tenant-scoped SQLite keyword search over published articles. */
export function searchPublicPosts(siteId: string, query: string, limit = SEARCH_PAGE_LIMIT) {
  return searchPublicPostsPaginated({ siteId, query, page: 1, limit }).items;
}

/** Performs paginated tenant-scoped SQLite keyword search over published articles. */
export function searchPublicPostsPaginated(options: {
  siteId: string;
  query: string;
  page?: number;
  limit?: number;
}): PaginatedSearchResult {
  const db = getDb();
  const clean = options.query.trim().slice(0, 100);
  const limit = Math.max(1, Math.min(options.limit ?? SEARCH_PAGE_LIMIT, MAX_PUBLIC_PAGE_SIZE));
  const requestedPage = Math.max(1, options.page ?? 1);
  const baseCond = and(eq(posts.siteId, options.siteId), getPublicPostCondition());
  const searchCond = clean
    ? and(baseCond, or(like(posts.title, `%${clean}%`), like(posts.excerpt, `%${clean}%`), like(posts.slug, `%${clean}%`)))
    : baseCond;

  const totalCount = db.select({ total: count() }).from(posts).where(searchCond).get()?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  const items = db
    .select({ id: posts.id, title: posts.title, slug: posts.slug, excerpt: posts.excerpt })
    .from(posts)
    .where(searchCond)
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset)
    .all();

  return { items, totalCount, page, totalPages, hasMore: page < totalPages };
}
