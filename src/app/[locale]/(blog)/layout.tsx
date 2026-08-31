import type { Metadata } from "next";
import { getActiveSite, getSiteForHost, hasAdminUser, normalizeDomain } from "@/lib/tenant";
import { getCategories } from "@/actions/categories";
import { getDb } from "@/lib/db";
import { posts, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { publishScheduledPosts, getPublicPostCondition } from "@/lib/db/scheduled";
import { Header } from "@/components/blog/Header";
import { HeaderBanner } from "@/components/blog/HeaderBanner";
import { Footer } from "@/components/blog/Footer";
import { ScrollToTop } from "@/components/blog/ScrollToTop";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { redirect } from "@/i18n/routing";
import { headers } from "next/headers";
import { getLocalizedText } from "@/lib/utils/localization";
import { getSiteBanners, getResolvedHeaderBanner } from "@/lib/banners";

import { normalizeMediaUrl } from "@/lib/storage";

/**
 * Dynamically computes metadata, robots directives, and favicon links for the public blog.
 *
 * @returns {Promise<Metadata>} Metadata configuration object with resolved assets and social tags.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = (await getSiteForHost()) || (await getActiveSite());
  const baseUrl = site?.domain ? `https://${site.domain}` : (process.env.SITE_URL || "http://localhost:3000");
  const defaultFavicon = "/icon.svg";
  const rawFavicon = site?.faviconUrl || defaultFavicon;
  const favicon = normalizeMediaUrl(rawFavicon) || defaultFavicon;
  const rawAppleIcon = site?.faviconUrl || site?.logoUrl || defaultFavicon;
  const appleIcon = normalizeMediaUrl(rawAppleIcon) || defaultFavicon;

  const db = getDb();
  const antiAiSetting = site
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.siteId, site.id), eq(settings.key, "block_ai_crawlers")))
        .get()
    : null;

  const isAiBlocked = antiAiSetting?.value === "true";

  return {
    metadataBase: new URL(baseUrl),
    icons: {
      icon: favicon.endsWith(".svg")
        ? [{ url: favicon, type: "image/svg+xml" }]
        : [{ url: favicon }],
      shortcut: favicon,
      apple: appleIcon,
    },
    alternates: {
      types: {
        "application/rss+xml": "/feed.xml",
      },
    },
    robots: {
      index: true,
      follow: true,
    },
    other: {
      ...(isAiBlocked
        ? {
            robots: "noai, noimageai",
            "tdm-reservation": "1",
          }
        : {}),
    },
  };
}

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
  const rawHost =
    headersList.get("x-forwarded-host")?.split(",")[0].trim() ||
    headersList.get("host")?.split(",")[0].trim() ||
    "localhost:3000";
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
    navLinks: null,
    navAlignment: "left" as const,
    supportedLocales: '["en"]',
  };

  const categories = site ? await getCategories(site.id) : [];

  const db = getDb();
  if (site) {
    await publishScheduledPosts(site.id);
  }

  const searchPosts = site
    ? db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
        })
        .from(posts)
        .where(and(eq(posts.siteId, site.id), getPublicPostCondition()))
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

  const bannersConfig = site ? await getSiteBanners(site.id) : { headerBanner: null, sidebarBanners: [] };

  const primaryColor = site?.primaryColor || "#3b82f6";
  const themeStyles = {
    "--color-primary": primaryColor,
    "--color-accent": primaryColor,
    "--color-primary-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
    "--color-accent-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
  } as React.CSSProperties;

  const activeHeaderBanner = bannersConfig.headerBanner
    ? getResolvedHeaderBanner(bannersConfig.headerBanner)
    : null;

  return (
    <div
      className="min-h-screen flex flex-col justify-between bg-bg text-text"
      style={themeStyles}
    >
      {site && <AnalyticsTracker siteId={site.id} />}
      {activeHeaderBanner && (
        <HeaderBanner
          imageUrl={activeHeaderBanner.imageUrl}
          linkUrl={activeHeaderBanner.linkUrl}
          target={activeHeaderBanner.target}
          alt={activeHeaderBanner.alt || getLocalizedText(siteData.name, locale)}
        />
      )}
      <Header site={siteData} categories={categories} searchPosts={searchPosts} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 animate-fade-in">
        {children}
      </main>
      <Footer
        siteName={getLocalizedText(siteData.name, locale)}
        subtitle={getLocalizedText(siteData.subtitle, locale)}
        categories={categories}
        enableLlmsTxt={enableLlmsTxt}
        navLinks={siteData.navLinks}
      />
      <ScrollToTop />
    </div>
  );
}
