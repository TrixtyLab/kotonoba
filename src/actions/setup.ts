"use server";

import { getDb } from "@/lib/db";
import { users, sites, categories, posts, postCategories, settings } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken, getSessionDuration, getRefreshDuration } from "@/lib/auth/jwt";
import { generateId, generateSlug } from "@/lib/utils/slug";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { renderMarkdownToHtml } from "@/lib/utils/markdown";

/**
 * Input configuration payload provided by the initial setup wizard.
 */
export interface SetupWizardData {
  /** Full display name of the primary administrator. */
  adminName: string;
  /** Primary administrator email address. */
  adminEmail: string;
  /** Plaintext administrator password to hash. */
  adminPassword: string;
  /** Display title for the initial blog site. */
  siteName: string;
  /** Subtitle and tagline for the initial blog site. */
  siteSubtitle: string;
  /** Bound domain hostname for routing (e.g., 'localhost', 'myblog.com'). */
  domain: string;
  /** Default BCP 47 language code for the blog. */
  locale: string;
  /** Default visual theme mode. */
  theme: "dark" | "light";
  /** Primary branding color in hex format. */
  primaryColor: string;
  /** Default typography font family name. */
  fontFamily: string;
  /** Name of the default starter category. */
  categoryName: string;
}

/**
 * Initializes the entire application state during first-time deployment.
 * Provisions the primary site entity, root administrator account, starter category, welcome blog post, default settings, and signs in the administrator.
 *
 * @param data - Full setup wizard configuration payload.
 * @returns A Promise resolving to an object indicating success with siteId and userId, or error message if already initialized.
 */
export async function completeSetupWizard(data: SetupWizardData) {
  const db = getDb();

  const adminCount = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .get();

  if (adminCount && adminCount.count > 0) {
    return { success: false, error: "System is already initialized." };
  }

  const siteId = generateId();
  const userId = generateId();
  const catId = generateId();
  const postId = generateId();
  const now = new Date();

  const domain = data.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "localhost";
  const passwordHash = await hashPassword(data.adminPassword);

  db.insert(sites)
    .values({
      id: siteId,
      name: data.siteName || "My Blog",
      subtitle: data.siteSubtitle || "A modern blog powered by Kotonoba",
      description: data.siteSubtitle || "A modern blog powered by Kotonoba",
      domain,
      locale: data.locale || "en",
      theme: data.theme || "dark",
      primaryColor: data.primaryColor || "#3b82f6",
      fontFamily: data.fontFamily || "Inter",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(users)
    .values({
      id: userId,
      email: data.adminEmail.toLowerCase().trim(),
      passwordHash,
      displayName: data.adminName.trim() || "Administrator",
      role: "super_admin",
      siteId,
      createdAt: now,
    })
    .run();

  const catName = data.categoryName.trim() || "General";
  const catSlug = generateSlug(catName);

  db.insert(categories)
    .values({
      id: catId,
      siteId,
      name: catName,
      slug: catSlug,
      description: "Default blog category",
      sortOrder: 0,
    })
    .run();

  const postTitle = "Welcome to your new Kotonoba CMS";
  const postSlug = generateSlug(postTitle);
  const welcomeContent = `# Welcome to Kotonoba

Congratulations on setting up your new high-performance, multi-tenant blog.

## Features at a Glance
- **Next.js 16 + React 19** with Turbopack and lightning-fast Server Components.
- **Tiptap Rich-Text Editor** with live preview, markdown conversion, and Mermaid diagram support.
- **70+ Languages** powered by \`next-intl\`.
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

  db.insert(posts)
    .values({
      id: postId,
      siteId,
      authorId: userId,
      title: postTitle,
      slug: postSlug,
      contentMd: welcomeContent,
      contentHtml: renderMarkdownToHtml(welcomeContent),
      excerpt: "Your new Kotonoba site is up and running. Explore the admin panel, write articles, and customize your theme.",
      status: "published",
      locale: data.locale || "en",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      views: 1,
      pinned: true,
    })
    .run();

  db.insert(postCategories)
    .values({
      postId,
      categoryId: catId,
    })
    .run();

  const defaultSettings = [
    { key: "llms_txt_enabled", value: "false" },
    { key: "block_ai_crawlers", value: "false" },
    { key: "ai_enabled", value: "false" },
    { key: "ai_api_url", value: "https://api.openai.com/v1" },
    { key: "ai_model", value: "gpt-4o" },
    { key: "ai_temperature", value: "0.7" },
  ];

  for (const s of defaultSettings) {
    db.insert(settings)
      .values({
        siteId,
        key: s.key,
        value: s.value,
      })
      .run();
  }

  const accessToken = await signAccessToken({
    userId,
    email: data.adminEmail.toLowerCase().trim(),
    role: "super_admin",
    siteId,
  });
  const refreshToken = await signRefreshToken(userId);

  const { maxAgeSeconds: sessionMaxAge } = getSessionDuration();
  const { maxAgeSeconds: refreshMaxAge } = getRefreshDuration();

  const cookieStore = await cookies();
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });

  return { success: true, siteId, userId };
}
