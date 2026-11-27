import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

/**
 * Returns the tenant-scoped cache tag protecting public queries for a specific blog site.
 *
 * @param siteId - Owning site identifier.
 * @returns Cache tag string isolated to that site.
 */
export function sitePostsCacheTag(siteId: string): string {
  return `site:${siteId}:posts`;
}

/**
 * Returns the shared cache tag covering host-to-tenant registry resolution (`sites` table).
 *
 * @returns Cache tag string invalidated on site/domain mutations.
 */
export function tenantRegistryCacheTag(): string {
  return "tenant:registry";
}

function safeRevalidateTag(tag: string): void {
  try {
    if (typeof revalidateTag === "function") {
      revalidateTag(tag, { expire: 0 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes("staticGenerationStore") && !msg.includes("incrementalCache")) {
      throw error;
    }
  }
}

/**
 * Executes a tenant-scoped read function behind Next.js `unstable_cache`, gracefully falling back
 * to direct execution when invoked outside Next.js HTTP runtime (e.g. Vitest integration runs).
 *
 * @param fn - Asynchronous pure data loader (must not read `headers()`/`cookies()`).
 * @param keyParts - Deterministic cache key components including `(siteId, locale, host)`.
 * @param options - Cache tags and optional TTL seconds.
 * @returns Cached or freshly evaluated query result.
 */
export async function runWithTenantCache<TResult>(
  fn: () => Promise<TResult>,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number }
): Promise<TResult> {
  if (typeof unstable_cache !== "function") {
    return fn();
  }
  try {
    const cachedFn = unstable_cache(fn, keyParts, options);
    return await cachedFn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("incrementalCache missing") || msg.includes("staticGenerationStore")) {
      return fn();
    }
    throw error;
  }
}

/**
 * Revalidates public, SEO, feed, and admin routes affected when a blog post is created, edited, deleted, or published.
 *
 * @param slug - Current post slug.
 * @param previousSlug - Prior post slug when renamed.
 * @param siteId - Optional owning site identifier for surgical tenant cache invalidation.
 */
export function revalidatePostPaths(
  slug?: string | null,
  previousSlug?: string | null,
  siteId?: string | null
): void {
  revalidatePath("/[locale]/admin/posts", "page");
  revalidatePath("/[locale]/admin", "page");
  if (slug) {
    revalidatePath(`/[locale]/entry/${slug}`, "page");
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/[locale]/entry/${previousSlug}`, "page");
  }
  revalidateFeedsAndSitemap();
  safeRevalidateTag(siteId ? sitePostsCacheTag(siteId) : "public-posts");
}

/**
 * Revalidates public, SEO, and admin routes affected when a custom static page changes.
 *
 * @param slug - Current page slug.
 * @param previousSlug - Prior page slug when renamed.
 * @param siteId - Optional owning site identifier for surgical tenant cache invalidation.
 */
export function revalidatePagePaths(
  slug?: string | null,
  previousSlug?: string | null,
  siteId?: string | null
): void {
  revalidatePath("/[locale]/admin/pages", "page");
  if (slug) {
    revalidatePath(`/[locale]/p/${slug}`, "page");
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/[locale]/p/${previousSlug}`, "page");
  }
  revalidatePath("/sitemap.xml", "page");
  safeRevalidateTag(siteId ? sitePostsCacheTag(siteId) : "public-posts");
}

function revalidateFeedsAndSitemap(): void {
  revalidatePath("/sitemap.xml", "page");
  revalidatePath("/feed.xml", "page");
  revalidatePath("/rss.xml", "page");
  revalidatePath("/llms.txt", "page");
  revalidatePath("/llms-full.txt", "page");
}

/**
 * Revalidates site shell, host registry, taxonomy, branding, and settings routes across all locales.
 *
 * @param siteId - Optional owning site identifier for surgical tenant cache invalidation.
 */
export function revalidateSiteShell(siteId?: string | null): void {
  revalidateFeedsAndSitemap();
  safeRevalidateTag(tenantRegistryCacheTag());
  safeRevalidateTag(siteId ? sitePostsCacheTag(siteId) : "public-posts");
}

/**
 * Revalidates user management admin views after role, assignment, or account updates.
 */
export function revalidateUsersAdmin(): void {
  revalidatePath("/[locale]/admin/users", "page");
}

/**
 * Revalidates analytics dashboards after data reset or segment mutations.
 */
export function revalidateAnalyticsPaths(): void {
  revalidatePath("/[locale]/admin/analytics", "layout");
  revalidatePath("/[locale]/admin/analytics/segments", "page");
  revalidatePath("/[locale]/admin", "page");
  revalidatePath("/[locale]/admin/posts", "page");
  revalidatePath("/[locale]/admin/pages", "page");
}
