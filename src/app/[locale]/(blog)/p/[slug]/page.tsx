import { getPublicSite, getRequestNormalizedHost } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { Sparkles } from "lucide-react";
import { extractMermaidDiagrams, renderPostContent } from "@/lib/utils/markdown";
import { resolveCanonicalBodyText } from "@/lib/content/canonical";
import { getCachedLatestPublicPostsSummary } from "@/lib/queries/public-posts";
import { getCachedPublicPageBySlug } from "@/lib/queries/pages";
import { getCachedSiteCategories } from "@/lib/queries/taxonomy";
import { DEFAULT_PUBLIC_PAGE_SIZE } from "@/lib/config/constants";
import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { getCachedSidebarBanners } from "@/lib/banners";
import { SafeHtml } from "@/components/SafeHtml";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

/**
 * Generates OpenGraph, Twitter, and canonical SEO metadata tags for a published custom page.
 *
 * @param props - Object containing route params Promise with page slug and active locale code.
 * @returns Metadata object configured for search engines and social cards.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  const t = await getTranslations({ locale, namespace: "blog" });
  if (!site) return { title: t("noPosts") };

  const page = await getCachedPublicPageBySlug(site.id, slug, locale, host);

  if (!page) return { title: "Page Not Found" };

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/p/${page.slug}`;
  const siteName = getLocalizedText(site.name, locale);

  const coverImageUrl = resolveAbsoluteUrl(page.coverImage, baseUrl);
  const fallbackImageUrl = resolveAbsoluteUrl(site.logoUrl || site.faviconUrl, baseUrl);
  const socialImageUrl = coverImageUrl || fallbackImageUrl;

  return {
    metadataBase: new URL(baseUrl),
    title: `${page.title} — ${siteName}`,
    description: page.excerpt || `${page.title} - ${siteName}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: page.title,
      description: page.excerpt || undefined,
      url: canonicalUrl,
      siteName: siteName,
      type: "article",
      publishedTime: page.publishedAt?.toISOString(),
      images: socialImageUrl
        ? [
            {
              url: socialImageUrl,
              alt: page.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.excerpt || undefined,
      images: socialImageUrl ? [socialImageUrl] : undefined,
    },
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Public custom page reading view rendering formatted markdown HTML and social share buttons.
 *
 * @param {Object} props - Component properties.
 * @param {Promise<{ slug: string; locale: string }>} props.params - Promise resolving to route parameters with page slug and active locale.
 * @returns {Promise<React.JSX.Element>} React JSX full custom page view.
 */
export default async function CustomPageEntry({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });
  const [page, allCategories, latestPosts, sidebarBanners] = await Promise.all([
    getCachedPublicPageBySlug(site.id, slug, locale, host),
    getCachedSiteCategories(site.id, locale, host),
    getCachedLatestPublicPostsSummary(site.id, DEFAULT_PUBLIC_PAGE_SIZE, locale, host),
    getCachedSidebarBanners(site.id, host),
  ]);

  if (!page) notFound();

  const rawBody = resolveCanonicalBodyText(page);
  const mermaidDiagrams = extractMermaidDiagrams(rawBody, page.contentMd, page.contentHtml);
  const renderedHtml = renderPostContent(rawBody, {
    format: page.contentFormat ?? undefined,
    utmSource:
      site?.domain && !site.domain.includes("localhost")
        ? site.domain.replace(/^https?:\/\//, "").split(":")[0]
        : typeof site?.name === "string" && site.name.trim()
        ? site.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
        : "myblog",
    utmCampaign: page.slug,
    utmMedium: "page_embed",
  });

  const pageUrl = `https://${site.domain}/p/${page.slug}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Page Content */}
      <article className="lg:col-span-8 min-w-0 w-full space-y-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text tracking-tight leading-snug">
          {page.title}
        </h1>

        {page.excerpt && (
          <p className="text-sm text-text-muted leading-relaxed font-medium">
            {page.excerpt}
          </p>
        )}

        {/* Content */}
        <SafeHtml className="prose-blog pt-2" html={renderedHtml} />

        {/* Mermaid Diagrams */}
        {mermaidDiagrams.length > 0 && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text pb-2.5 border-b border-border/40">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Diagrams ({mermaidDiagrams.length})</span>
            </div>
            {mermaidDiagrams.map((chart, idx) => (
              <MermaidRenderer key={idx} chart={chart} />
            ))}
          </div>
        )}

        {/* Bottom Share Bar */}
        <div className="pt-4 flex items-center justify-between border-t border-border/40 text-xs text-text-muted">
          <span>{t("sharePage")}:</span>
          <ShareButtons title={page.title} url={pageUrl} />
        </div>
      </article>

      {/* Right Column: Profile Sidebar */}
      <div className="lg:col-span-4 min-w-0 w-full lg:sticky lg:top-20 self-start">
        <LineSidebar
          site={site}
          latestPosts={latestPosts}
          categories={allCategories}
          sidebarBanners={sidebarBanners}
          locale={locale}
        />
      </div>
    </div>
  );
}
