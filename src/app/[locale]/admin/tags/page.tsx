import { getActiveSite } from "@/lib/tenant";
import { getTags } from "@/actions/tags";
import { TagsManagerClient } from "@/components/admin/TagsManagerClient";
import { notFound } from "next/navigation";

/**
 * Server page component loading site tags and rendering the tag management interface.
 *
 * @returns React JSX tags manager view.
 */
export default async function AdminTagsPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const tags = await getTags(site.id);

  return (
    <TagsManagerClient
      siteId={site.id}
      initialTags={tags}
    />
  );
}
