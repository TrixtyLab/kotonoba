import { getActiveSite } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { CategoriesManagerClient } from "@/components/admin/CategoriesManagerClient";
import { notFound } from "next/navigation";

/**
 * Server page component loading site categories and rendering the category taxonomy manager interface.
 *
 * @returns React JSX categories manager view.
 */
export default async function AdminCategoriesPage() {
  const site = await getActiveSite();
  if (!site) notFound();

  const categories = await getCategories(site.id);

  return (
    <CategoriesManagerClient
      siteId={site.id}
      initialCategories={categories}
    />
  );
}
