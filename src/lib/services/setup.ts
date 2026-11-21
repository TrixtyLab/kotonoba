import { getDb } from "@/lib/db";
import { users, sites, categories, posts, postCategories, settings } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { normalizeLocale } from "@/i18n/locales";
import { strongPasswordSchema } from "@/lib/contracts";
import { POST_STATUS, ROLES } from "@/lib/config/constants";
import { renderMarkdownToHtml } from "@/lib/utils/markdown";
import type { SessionCookieSubject } from "@/lib/auth/cookies";

const setupWizardSchema = z.object({
  adminName: z.string().min(1).max(100),
  adminEmail: z.string().email().max(255),
  adminPassword: strongPasswordSchema,
  siteName: z.string().min(1).max(200),
  siteSubtitle: z.string().max(500).default(""),
  domain: z.string().min(1).max(500),
  locale: z.string().optional(),
  theme: z.enum(["dark", "light"]).default("dark"),
  primaryColor: z.string().max(7).default("#3b82f6"),
  fontFamily: z.string().max(100).default("Inter"),
  categoryName: z.string().max(200).default("General"),
});

/** Input configuration payload provided by the initial setup wizard. */
export interface SetupWizardData {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  siteName: string;
  siteSubtitle: string;
  domain: string;
  locale: string;
  theme: "dark" | "light";
  primaryColor: string;
  fontFamily: string;
  categoryName: string;
}

/**
 * Validates and atomically initializes the first Kotonoba tenant, super administrator, starter post, and settings.
 */
export async function completeSetupWizardService(
  data: SetupWizardData
): Promise<
  | { success: true; siteId: string; userId: string; session: SessionCookieSubject }
  | { success: false; error: string }
> {
  const parsed = setupWizardSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      success: false,
      error: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid setup configuration.",
    };
  }

  const valid = parsed.data;
  const db = getDb();

  const existingBefore = db.select({ count: sql<number>`count(*)` }).from(users).get();
  if (existingBefore && existingBefore.count > 0) {
    return { success: false, error: "System is already initialized." };
  }

  const siteId = generateId();
  const userId = generateId();
  const catId = generateId();
  const postId = generateId();
  const now = new Date();
  const domain = valid.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() || "localhost";
  const siteLocale = normalizeLocale(valid.locale);
  const cleanEmail = valid.adminEmail.toLowerCase().trim();
  const passwordHash = await hashPassword(valid.adminPassword);

  const welcomeContent = `# Welcome to Kotonoba

Congratulations on setting up your new high-performance, multi-tenant blog.

## Features at a Glance
- **Next.js 16 + React 19** with SQLite WAL persistence and Server Components.
- **Tiptap Rich-Text Editor** with live preview, markdown conversion, and Mermaid diagram support.
- **English & Spanish (en / es)** localization powered by \`next-intl\`.
- **Dark & Light Mode** with smooth transitions.
- **LLMs.txt & SEO** optimized out of the box for AI search engines.

\`\`\`mermaid
graph LR
  Admin[Admin Panel] -->|Publish| SQLite[(SQLite DB)]
  SQLite --> Public[Next.js Public Blog]
  Public --> Readers[Global Readers]
\`\`\`

Feel free to edit or delete this post from your new admin dashboard. Happy blogging!
`;
  const renderedWelcome = renderMarkdownToHtml(welcomeContent);

  const txResult = db.transaction((tx) => {
    const adminCount = tx.select({ count: sql<number>`count(*)` }).from(users).get();
    if (adminCount && adminCount.count > 0) {
      return { alreadyInitialized: true as const };
    }

    tx.insert(sites)
      .values({
        id: siteId,
        name: valid.siteName || "My Blog",
        subtitle: valid.siteSubtitle || "A modern blog powered by Kotonoba",
        description: valid.siteSubtitle || "A modern blog powered by Kotonoba",
        domain,
        locale: siteLocale,
        theme: valid.theme || "dark",
        primaryColor: valid.primaryColor || "#3b82f6",
        fontFamily: valid.fontFamily || "Inter",
        supportedLocales: JSON.stringify([siteLocale]),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    tx.insert(users)
      .values({
        id: userId,
        email: cleanEmail,
        passwordHash,
        displayName: valid.adminName.trim() || "Administrator",
        role: ROLES.SUPER_ADMIN,
        siteId,
        tokenVersion: 1,
        createdAt: now,
      })
      .run();

    const catName = valid.categoryName.trim() || "General";
    tx.insert(categories)
      .values({
        id: catId,
        siteId,
        name: catName,
        slug: generateSlug(catName),
        description: "Default blog category",
        sortOrder: 0,
      })
      .run();

    const postTitle = "Welcome to your new Kotonoba CMS";
    tx.insert(posts)
      .values({
        id: postId,
        siteId,
        authorId: userId,
        title: postTitle,
        slug: generateSlug(postTitle),
        content: welcomeContent,
        contentMd: welcomeContent,
        contentHtml: renderedWelcome,
        contentFormat: "markdown",
        excerpt: "Your new Kotonoba site is up and running. Explore the admin panel, write articles, and customize your theme.",
        status: POST_STATUS.PUBLISHED,
        locale: siteLocale,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        views: 1,
        pinned: true,
      })
      .run();

    tx.insert(postCategories).values({ postId, categoryId: catId }).run();

    const defaultSettings = [
      { key: "llms_txt_enabled", value: "false" },
      { key: "block_ai_crawlers", value: "false" },
      { key: "discord_notifications_enabled", value: "false" },
      { key: "bluesky_enabled", value: "false" },
      { key: "bluesky_service_url", value: "https://bsky.social" },
      { key: "bluesky_identifier", value: "" },
      { key: "bluesky_app_password", value: "" },
      { key: "bluesky_include_tags", value: "true" },
      { key: "bluesky_include_title", value: "true" },
      { key: "bluesky_include_description", value: "true" },
      { key: "rss_enabled", value: "true" },
      { key: "rss_items_count", value: "20" },
      { key: "rss_full_content", value: "true" },
      { key: "ai_enabled", value: "false" },
      { key: "ai_api_url", value: "https://api.openai.com/v1" },
      { key: "ai_model", value: "gpt-4o" },
      { key: "ai_temperature", value: "0.7" },
    ];

    for (const s of defaultSettings) {
      tx.insert(settings).values({ siteId, key: s.key, value: s.value }).run();
    }

    return { alreadyInitialized: false as const };
  });

  if (txResult.alreadyInitialized) {
    return { success: false, error: "System is already initialized." };
  }

  return {
    success: true,
    siteId,
    userId,
    session: {
      userId,
      email: cleanEmail,
      role: ROLES.SUPER_ADMIN,
      siteId,
      tokenVersion: 1,
    },
  };
}
