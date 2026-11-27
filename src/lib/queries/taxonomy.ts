import { getDb } from "@/lib/db";
import { categories, tags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { runWithTenantCache, sitePostsCacheTag } from "@/lib/cache/revalidate";

/** Lightweight taxonomy descriptor shared across post cards and sidebars. */
export interface TaxonomySummary {
  id: string;
  name: string;
  slug: string;
}

/** Tenant-cached list of categories belonging to a site for sidebar navigation. */
export async function getCachedSiteCategories(
  siteId: string,
  locale = "en",
  host = "default"
) {
  return runWithTenantCache(
    async () => {
      const db = getDb();
      return db.select().from(categories).where(eq(categories.siteId, siteId)).all();
    },
    ["site-categories", siteId, host, locale],
    {
      tags: [sitePostsCacheTag(siteId)],
      revalidate: 60,
    }
  );
}

/** Tenant-cached lookup for a single category by slug keyed by `(siteId, host, locale, slug)`. */
export async function getCachedCategoryBySlug(
  siteId: string,
  slug: string,
  locale = "en",
  host = "default"
) {
  return runWithTenantCache(
    async () => {
      const db = getDb();
      return (
        db
          .select()
          .from(categories)
          .where(and(eq(categories.siteId, siteId), eq(categories.slug, slug)))
          .get() || null
      );
    },
    ["site-category-by-slug", siteId, host, locale, slug],
    {
      tags: [sitePostsCacheTag(siteId)],
      revalidate: 60,
    }
  );
}

/** Tenant-cached lookup for a single tag by slug keyed by `(siteId, host, locale, slug)`. */
export async function getCachedTagBySlug(
  siteId: string,
  slug: string,
  locale = "en",
  host = "default"
) {
  return runWithTenantCache(
    async () => {
      const db = getDb();
      return (
        db
          .select()
          .from(tags)
          .where(and(eq(tags.siteId, siteId), eq(tags.slug, slug)))
          .get() || null
      );
    },
    ["site-tag-by-slug", siteId, host, locale, slug],
    {
      tags: [sitePostsCacheTag(siteId)],
      revalidate: 60,
    }
  );
}
