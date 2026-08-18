import { getActiveSite, hasAdminUser } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { Header } from "@/components/blog/Header";
import { Footer } from "@/components/blog/Footer";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { redirect } from "@/i18n/routing";

/**
 * Public blog layout wrapping all reader-facing pages with consistent header, footer, and analytics.
 * If no admin user is registered, automatically redirects visitors to the setup wizard.
 */
export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminExists = hasAdminUser();

  if (!adminExists) {
    redirect({ href: "/setup", locale });
  }

  const site = await getActiveSite();
  const siteData = site || {
    id: "default",
    name: "Kotonoba",
    subtitle: "Modern Multi-Tenant CMS",
    logoUrl: null,
  };

  const categories = site ? await getCategories(site.id) : [];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-bg text-text">
      {site && <AnalyticsTracker siteId={site.id} />}
      <Header site={siteData} categories={categories} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>
      <Footer siteName={siteData.name} subtitle={siteData.subtitle} categories={categories} />
    </div>
  );
}
