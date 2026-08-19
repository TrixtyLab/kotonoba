import { getActiveSite, getSiteForHost, hasAdminUser, normalizeDomain } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { getDb } from "@/lib/db";
import { posts, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Header } from "@/components/blog/Header";
import { Footer } from "@/components/blog/Footer";
import { ScrollToTop } from "@/components/blog/ScrollToTop";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { redirect } from "@/i18n/routing";
import { headers } from "next/headers";

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

  // Verify incoming host domain matching
  const headersList = await headers();
  const rawHost = headersList.get("host") || "localhost:3000";
  const cleanHost = normalizeDomain(rawHost);
  const isLocal =
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost === "::1" ||
    cleanHost.endsWith(".localhost");

  const siteForHost = await getSiteForHost();
  const adminDomain = process.env.ADMIN_DOMAIN
    ? normalizeDomain(process.env.ADMIN_DOMAIN)
    : null;

  // If visiting the designated dashboard domain or a non-blog host in production, redirect to /admin
  const isExplicitAdminDomain = Boolean(adminDomain && cleanHost === adminDomain);
  const isNonBlogDomain = !siteForHost && !isLocal;

  if (isExplicitAdminDomain || isNonBlogDomain) {
    redirect({ href: "/admin", locale });
  }

  const site = siteForHost || (isLocal ? await getActiveSite() : null);
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

  const rssSetting = site
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, site.id), eq(settings.key, "rss_enabled")))
        .get()
    : null;

  const isRssEnabled = rssSetting?.value !== "false";

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
      <head>
        {isAiBlocked && <meta name="robots" content="noai, noimageai" />}
        {isAiBlocked && <meta name="tdm-reservation" content="1" />}
        <link rel="icon" href={site?.faviconUrl || "/favicon.ico"} />
        <link rel="shortcut icon" href={site?.faviconUrl || "/favicon.ico"} />
        <link rel="apple-touch-icon" href={site?.faviconUrl || site?.logoUrl || "/favicon.ico"} />
        {isRssEnabled && (
          <link
            rel="alternate"
            type="application/rss+xml"
            title={`${siteData.name} RSS Feed`}
            href="/feed.xml"
          />
        )}
      </head>
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
