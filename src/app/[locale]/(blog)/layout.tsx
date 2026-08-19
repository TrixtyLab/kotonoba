import { getActiveSite, hasAdminUser } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { getDb } from "@/lib/db";
import { posts, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Header } from "@/components/blog/Header";
import { Footer } from "@/components/blog/Footer";
import { ScrollToTop } from "@/components/blog/ScrollToTop";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { redirect } from "@/i18n/routing";

/**
 * Public blog shell layout applying custom CSS accent colors, header navigation, analytics beacon tracking, and footer branding.
 *
 * @param props - Object containing children elements and route params Promise.
 * @returns React JSX public blog layout.
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
    subtitle: "",
    logoUrl: null,
  };

  const categories = site ? await getCategories(site.id) : [];

  const db = getDb();
  const searchPosts = site
    ? db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
        })
        .from(posts)
        .where(and(eq(posts.siteId, site.id), eq(posts.status, "published")))
        .all()
    : [];

  const antiAiSetting = site
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, site.id), eq(settings.key, "block_ai_crawlers")))
        .get()
    : null;

  const isAiBlocked = antiAiSetting?.value === "true";

  const llmsSetting = site
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, site.id), eq(settings.key, "llms_txt_enabled")))
        .get()
    : null;

  const enableLlmsTxt = !isAiBlocked && llmsSetting?.value === "true";

  const primaryColor = site?.primaryColor || "#3b82f6";
  const themeStyles = {
    "--color-primary": primaryColor,
    "--color-accent": primaryColor,
    "--color-primary-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
    "--color-accent-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen flex flex-col justify-between bg-bg text-text"
      style={themeStyles}
    >
      {isAiBlocked && (
        <head>
          <meta name="robots" content="noai, noimageai" />
          <meta name="tdm-reservation" content="1" />
        </head>
      )}
      {site && <AnalyticsTracker siteId={site.id} />}
      <Header site={siteData} categories={categories} searchPosts={searchPosts} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 animate-fade-in">
        {children}
      </main>
      <Footer
        siteName={siteData.name}
        subtitle={siteData.subtitle}
        categories={categories}
        enableLlmsTxt={enableLlmsTxt}
      />
      <ScrollToTop />
    </div>
  );
}
