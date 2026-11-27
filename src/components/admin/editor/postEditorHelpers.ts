import { LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from "@/i18n/routing";
import { POST_STATUSES, type PostStatus } from "@/lib/config/constants";
import { extractItchId, extractSteamId } from "@/lib/utils/embeds";
import { renderPostContent } from "@/lib/utils/markdown";

/** Pre-existing post or page record loaded into {@link PostEditor}. */
export interface InitialPostRecord {
  id: string;
  title: string;
  slug: string;
  content?: string;
  contentMd?: string;
  contentHtml?: string;
  contentFormat?: "html" | "markdown";
  excerpt: string;
  coverImage: string | null;
  status: PostStatus;
  publishedAt?: string | Date | null;
  locale: string;
  pinned?: boolean;
  shortUrl?: string | null;
  categories?: string[];
  tags?: string[];
}

export const ALL_LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = LOCALES.map((code) => ({
  value: code,
  label: `${LOCALE_NAMES[code]} (${code})`,
}));

export function buildEditorSnapshot(state: {
  title: string;
  slug: string;
  contentHtml: string;
  excerpt: string;
  coverImage: string;
}): string {
  return JSON.stringify(state);
}

export function resolveInitialEditorHtml(initialPost?: InitialPostRecord): string {
  if (!initialPost) return "";
  const canonical = (initialPost.content || "").trim();
  if (canonical) {
    return initialPost.contentFormat === "markdown" && !/^<[a-z!/]/i.test(canonical)
      ? renderPostContent(canonical, { format: "markdown" })
      : canonical;
  }
  if (initialPost.contentHtml && initialPost.contentHtml.trim().length > 0) {
    return initialPost.contentHtml;
  }
  if (!initialPost.contentMd) return "";
  return initialPost.contentFormat === "markdown"
    ? renderPostContent(initialPost.contentMd, { format: "markdown" })
    : initialPost.contentMd;
}

export function formatDateTimeLocal(date?: Date | string | null): string {
  if (!date) {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function resolveAllowedLocales(supportedLocales?: string[]): Locale[] {
  const filtered = (supportedLocales || []).filter((code): code is Locale =>
    (LOCALES as readonly string[]).includes(code)
  );
  return Array.from(new Set([...LOCALES, ...filtered]));
}

function resolvePostCoreDefaults(initialPost: InitialPostRecord | undefined) {
  return {
    title: initialPost?.title || "",
    slug: initialPost?.slug || "",
    isSlugManual: Boolean(initialPost?.id && initialPost?.slug),
    excerpt: initialPost?.excerpt || "",
    coverImage: initialPost?.coverImage || "",
  };
}

function resolvePostLifecycleDefaults(initialPost: InitialPostRecord | undefined, fallbackLocale: Locale) {
  return {
    status: initialPost?.status || POST_STATUSES[0],
    scheduledAt: formatDateTimeLocal(initialPost?.publishedAt),
    locale: normalizeLocale(initialPost?.locale || fallbackLocale),
    pinned: initialPost?.pinned ?? false,
    categories: initialPost?.categories || [],
    tags: initialPost?.tags || [],
  };
}

export function resolveInitialPostDefaults(
  initialPost: InitialPostRecord | undefined,
  fallbackLocale: Locale
) {
  return {
    ...resolvePostCoreDefaults(initialPost),
    ...resolvePostLifecycleDefaults(initialPost, fallbackLocale),
  };
}

export function resolveIframeEmbedPaste(
  event: ClipboardEvent
): { shortcodeHtml: string; toastKey: "itchInserted" | "steamInserted" } | null {
  const raw = (event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text/html") || "").trim();
  if (!/<iframe[^>]*src=["']https?:\/\/(?:store\.steampowered\.com\/widget|itch\.io\/embed)[^"']*["']/i.test(raw)) {
    return null;
  }
  const itchId = extractItchId(raw);
  if (itchId) return { shortcodeHtml: `<p>@[itch](${itchId})</p>`, toastKey: "itchInserted" };
  const steamId = extractSteamId(raw);
  if (steamId) return { shortcodeHtml: `<p>@[steam](${steamId})</p>`, toastKey: "steamInserted" };
  return null;
}
