import { getActiveSite } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { PostEditor } from "@/components/admin/PostEditor";
import { notFound } from "next/navigation";

/**
 * Server page component loading an existing custom page by identifier and initializing the editor with its contents.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ id: string }>} props.params - Promise resolving to route parameters with the unique target page database ID.
 * @returns {Promise<React.JSX.Element>} React JSX page editor view.
 */
export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getActiveSite();
  if (!site) notFound();

  const db = getDb();
  const page = db.select().from(pages).where(and(eq(pages.id, id), eq(pages.siteId, site.id))).get();
  if (!page) notFound();

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
      mode="page"
      supportedLocales={supportedLocales}
      isDubEnabled={false}
      initialPost={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        contentMd: page.contentMd || "",
        excerpt: page.excerpt || "",
        coverImage: page.coverImage,
        status: page.status,
        locale: page.locale,
      }}
      availableCategories={[]}
      availableTags={[]}
    />
  );
}
