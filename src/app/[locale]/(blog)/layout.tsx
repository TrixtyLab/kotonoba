import type { Metadata } from "next";
import { getPublicSite, getRequestNormalizedHost, getSiteForHost, hasAdminUser, normalizeDomain } from "@/lib/tenant";
import { getCachedSiteCategories } from "@/lib/queries/taxonomy";
import { getCachedLatestPublicPostsSummary } from "@/lib/queries/public-posts";
import { getCachedSiteSeoSettings } from "@/lib/queries/seo";
import { Header } from "@/components/blog/Header";
import { HeaderBanner } from "@/components/blog/HeaderBanner";
import { Footer } from "@/components/blog/Footer";
import { ScrollToTop } from "@/components/blog/ScrollToTop";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { redirect } from "@/i18n/routing";
import { headers } from "next/headers";
import { getLocalizedText } from "@/lib/utils/localization";
import { getCachedSiteBanners, getResolvedHeaderBanner } from "@/lib/banners";
import { getAdminDomainEnv, getDefaultSiteUrl } from "@/lib/config/env";
import { getRequestHost } from "@/lib/http/request";
import { normalizeMediaUrl } from "@/lib/utils/media";
import { resolveBrandFont } from "@/lib/config/brand";
import { SafeCustomCss } from "@/components/SafeCustomCss";

export const dynamic = "force-dynamic";

/**
 * Dynamically computes metadata, robots directives, and favicon links for the public blog.
 *
 * @returns {Promise<Metadata>} Metadata configuration object with resolved assets and social tags.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  const baseUrl = site?.domain ? `https://${site.domain}` : getDefaultSiteUrl();
  const defaultFavicon = "/icon.svg";
  const rawFavicon = site?.faviconUrl || defaultFavicon;
  const favicon = normalizeMediaUrl(rawFavicon) || defaultFavicon;
  const rawAppleIcon = site?.faviconUrl || site?.logoUrl || defaultFavicon;
  const appleIcon = normalizeMediaUrl(rawAppleIcon) || defaultFavicon;

  const seo = site ? await getCachedSiteSeoSettings(site.id, host) : null;
  const isAiBlocked = Boolean(seo?.blockAiCrawlers);

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
  const rawHost = getRequestHost(headersList);
  const cleanHost = normalizeDomain(rawHost);
  const isLocal =
    cleanHost === "localhost" ||
    cleanHost === "127.0.0.1" ||
    cleanHost === "::1" ||
    cleanHost.endsWith(".localhost");

  const siteForHost = await getSiteForHost();
  const rawAdminDomain = getAdminDomainEnv();
  const adminDomain = rawAdminDomain ? normalizeDomain(rawAdminDomain) : null;

  // If visiting the designated dashboard domain or a non-blog host in production, redirect to /admin
  const isExplicitAdminDomain = Boolean(adminDomain && cleanHost === adminDomain);
  const isNonBlogDomain = !siteForHost && !isLocal;

  if (isExplicitAdminDomain || isNonBlogDomain) {
    redirect({ href: "/admin", locale });
  }

  const site = siteForHost || (isLocal ? await getPublicSite() : null);
  const host = cleanHost || (await getRequestNormalizedHost());
  const siteData = site || {
    id: "default",
    name: "Kotonoba",
    subtitle: "",
    logoUrl: null,
    navLinks: null,
    navAlignment: "left" as const,
    supportedLocales: '["en"]',
  };

  const [categories, rawSearchPosts, bannersConfig, seoSettings] = site
    ? await Promise.all([
        getCachedSiteCategories(site.id, locale, host),
        getCachedLatestPublicPostsSummary(site.id, 20, locale, host),
        getCachedSiteBanners(site.id, host),
        getCachedSiteSeoSettings(site.id, host),
      ])
    : [[], [], { headerBanner: null, sidebarBanners: [] }, { blockAiCrawlers: false, llmsTxtEnabled: false, llmsTxtCustom: "" }];

  const searchPosts = rawSearchPosts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  }));

  const isAiBlocked = seoSettings.blockAiCrawlers;
  const enableLlmsTxt = !isAiBlocked && seoSettings.llmsTxtEnabled;

  const primaryColor = site?.primaryColor || "#3b82f6";
  const brandFont = resolveBrandFont(site?.fontFamily);
  const themeStyles = {
    "--color-primary": primaryColor,
    "--color-accent": primaryColor,
    "--color-primary-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
    "--color-accent-hover": `color-mix(in srgb, ${primaryColor} 85%, black)`,
    fontFamily: brandFont.stack,
  } as React.CSSProperties;

  const activeHeaderBanner = bannersConfig.headerBanner
    ? getResolvedHeaderBanner(bannersConfig.headerBanner)
    : null;

  return (
    <div
      className="min-h-screen flex flex-col justify-between bg-bg text-text"
      style={themeStyles}
    >
      <SafeCustomCss css={site?.customCss} />
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
