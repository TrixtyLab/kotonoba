import { revalidatePath } from "next/cache";

/**
 * Revalidates public, SEO, feed, and admin routes affected when a blog post is created, edited, deleted, or published.
 *
 * @param slug - Current post slug.
 * @param previousSlug - Prior post slug when renamed.
 */
export function revalidatePostPaths(slug?: string | null, previousSlug?: string | null): void {
  revalidatePath("/[locale]/admin/posts", "page");
  revalidatePath("/[locale]/admin", "page");
  if (slug) {
    revalidatePath(`/[locale]/entry/${slug}`, "page");
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/[locale]/entry/${previousSlug}`, "page");
  }
  revalidateFeedsAndSitemap();
  revalidatePath("/", "layout");
}

/**
 * Revalidates public, SEO, and admin routes affected when a custom static page changes.
 *
 * @param slug - Current page slug.
 * @param previousSlug - Prior page slug when renamed.
 */
export function revalidatePagePaths(slug?: string | null, previousSlug?: string | null): void {
  revalidatePath("/[locale]/admin/pages", "page");
  if (slug) {
    revalidatePath(`/[locale]/p/${slug}`, "page");
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/[locale]/p/${previousSlug}`, "page");
  }
  revalidatePath("/sitemap.xml", "page");
  revalidatePath("/", "layout");
}

/**
 * Revalidates syndication feeds, AI discovery documents, and XML sitemaps.
 */
function revalidateFeedsAndSitemap(): void {
  revalidatePath("/sitemap.xml", "page");
  revalidatePath("/feed.xml", "page");
  revalidatePath("/rss.xml", "page");
  revalidatePath("/llms.txt", "page");
  revalidatePath("/llms-full.txt", "page");
}

/**
 * Revalidates site shell, taxonomy, branding, and settings routes across all locales.
 */
export function revalidateSiteShell(): void {
  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");
  revalidateFeedsAndSitemap();
}

/**
 * Revalidates user management admin views after role, assignment, or account updates.
 */
export function revalidateUsersAdmin(): void {
  revalidatePath("/", "layout");
  revalidatePath("/[locale]/admin/users", "page");
}

/**
 * Revalidates analytics dashboards after data reset or segment mutations.
 */
export function revalidateAnalyticsPaths(): void {
  revalidatePath("/admin/analytics", "layout");
  revalidatePath("/admin/analytics/segments", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/pages");
}
