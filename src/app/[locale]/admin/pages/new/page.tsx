import { getActiveSite } from "@/lib/tenant";
import { PostEditor } from "@/components/admin/PostEditor";
import { notFound } from "next/navigation";

/**
 * Server page component initializing the editor for composing a new static custom page.
 *
 * @returns {Promise<React.JSX.Element>} React JSX new custom page editor workspace.
 */
export default async function NewPagePage() {
  const site = await getActiveSite();
  if (!site) notFound();

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
      availableCategories={[]}
      availableTags={[]}
    />
  );
}
