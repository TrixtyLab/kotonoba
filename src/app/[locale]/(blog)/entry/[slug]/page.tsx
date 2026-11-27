import { getPublicSite, getRequestNormalizedHost } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils/date";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { LineSidebar } from "@/components/blog/LineSidebar";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { LikeButton } from "@/components/blog/LikeButton";
import { Link } from "@/i18n/routing";
import { Tag as TagIcon, Eye, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { extractMermaidDiagrams, renderPostContent } from "@/lib/utils/markdown";
import { resolveCanonicalBodyText } from "@/lib/content/canonical";
import { getCachedLatestPublicPostsSummary } from "@/lib/queries/public-posts";
import { getCachedPublicPostBySlug } from "@/lib/queries/public-post-detail";
import { getCachedSiteCategories } from "@/lib/queries/taxonomy";
import { DEFAULT_PUBLIC_PAGE_SIZE } from "@/lib/config/constants";
import { getLocalizedText } from "@/lib/utils/localization";
import { resolveAbsoluteUrl } from "@/lib/utils/media";
import { getCachedSidebarBanners } from "@/lib/banners";
import { SafeHtml } from "@/components/SafeHtml";

/**
 * Generates OpenGraph, Twitter, and canonical SEO metadata tags for a published blog post.
 *
 * @param props - Object containing route params with post slug and locale.
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

  const bundle = await getCachedPublicPostBySlug(site.id, slug, locale, host);
  if (!bundle) return { title: t("noPosts") };
  const { post } = bundle;

  const baseUrl = `https://${site.domain}`;
  const canonicalUrl = `${baseUrl}${locale === "en" ? "" : `/${locale}`}/entry/${post.slug}`;

  const siteName = getLocalizedText(site.name, locale);
  const coverImageUrl = resolveAbsoluteUrl(post.coverImage, baseUrl);
  const fallbackImageUrl = resolveAbsoluteUrl(site.logoUrl || site.faviconUrl, baseUrl);
  const socialImageUrl = coverImageUrl || fallbackImageUrl;

  return {
    metadataBase: new URL(baseUrl),
    title: `${post.title} — ${siteName}`,
    description: post.excerpt || `${post.title} - ${siteName}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      url: canonicalUrl,
      siteName: siteName,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: socialImageUrl
        ? [
            {
              url: socialImageUrl,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || undefined,
      images: socialImageUrl ? [socialImageUrl] : undefined,
    },
    icons: site?.faviconUrl ? [{ url: site.faviconUrl }] : undefined,
  };
}

/**
 * Public single article reading view rendering formatted markdown HTML, social share buttons, like reaction triggers, and sequential post navigation.
 *
 * @param props - Object containing route params Promise with article slug.
 * @returns React JSX full article reading page.
 */
export default async function PostEntryPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const [site, host] = await Promise.all([getPublicSite(), getRequestNormalizedHost()]);
  if (!site) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });

  const [bundle, allCategories, latestPosts, sidebarBanners] = await Promise.all([
    getCachedPublicPostBySlug(site.id, slug, locale, host),
    getCachedSiteCategories(site.id, locale, host),
    getCachedLatestPublicPostsSummary(site.id, DEFAULT_PUBLIC_PAGE_SIZE, locale, host),
    getCachedSidebarBanners(site.id, host),
  ]);

  if (!bundle) notFound();
  const { post, assignedCategories, assignedTags, prevPost, nextPost } = bundle;

  const postUrl = `https://${site.domain}/entry/${post.slug}`;
  const shareUrl = post.shortUrl || postUrl;

  const rawBody = resolveCanonicalBodyText(post);
  const mermaidDiagrams = extractMermaidDiagrams(rawBody, post.contentMd, post.contentHtml);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start w-full">
      {/* Left Column: Article Content */}
      <article className="lg:col-span-8 min-w-0 w-full space-y-6">
        {/* Article Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text tracking-tight leading-snug">
          {post.title}
        </h1>

        {/* Date & Categories */}
        <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
          {post.publishedAt && (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDate(post.publishedAt, locale)}
            </time>
          )}

          {assignedCategories.length > 0 && (
            <>
              <span className="text-text-muted/40">•</span>
              <div className="flex items-center gap-2 flex-wrap">
                {assignedCategories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/category/${c.slug}`}
                    className="font-medium text-accent hover:underline transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Body Content */}
        <SafeHtml
          className="prose-blog pt-2"
          html={renderPostContent(rawBody, {
            format: post.contentFormat ?? undefined,
            utmSource:
              site?.domain && !site.domain.includes("localhost")
                ? site.domain.replace(/^https?:\/\//, "").split(":")[0]
                : typeof site?.name === "string" && site.name.trim()
                ? site.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
                : "myblog",
            utmCampaign: post.slug,
            utmMedium: "article_embed",
          })}
        />

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

        {/* Bottom Reactions & Tags Bar */}
        <div className="pt-6 border-t border-border/40 flex flex-wrap items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <LikeButton postId={post.id} initialLikes={Math.floor((post.views || 0) / 8)} size="md" />

            {post.views !== undefined && post.views > 0 && (
              <span className="flex items-center gap-1 font-mono text-xs text-text-muted tabular-nums">
                <Eye className="w-3.5 h-3.5" />
                {post.views}
              </span>
            )}
          </div>

          {/* Tags list (🏷️ tag1 tag2) */}
          {assignedTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <TagIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
              {assignedTags.map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="hover:text-accent transition-colors"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Share buttons */}
        <div className="pt-4 flex items-center justify-between border-t border-border/40 text-xs text-text-muted">
          <span>{t("shareArticle")}:</span>
          <ShareButtons url={shareUrl} title={post.title} />
        </div>

        {/* Prev / Next article navigation */}
        <nav aria-label={t("articleNavigation")} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-border/40">
          {prevPost ? (
            <Link
              href={`/entry/${prevPost.slug}`}
              className="group flex flex-col items-start p-3 rounded-lg hover:bg-surface-hover/40 transition-colors text-left"
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-accent transition-colors">
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>{t("previousPost")}</span>
              </span>
              <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors line-clamp-2 mt-1">
                {prevPost.title}
              </span>
            </Link>
          ) : (
            <div />
          )}

          {nextPost && (
            <Link
              href={`/entry/${nextPost.slug}`}
              className="group flex flex-col items-end p-3 rounded-lg hover:bg-surface-hover/40 transition-colors text-right sm:col-start-2"
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-accent transition-colors">
                <span>{t("nextPost")}</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors line-clamp-2 mt-1">
                {nextPost.title}
              </span>
            </Link>
          )}
        </nav>
      </article>

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
