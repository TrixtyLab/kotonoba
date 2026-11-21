import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, posts, pages } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getClientIp, getRequestId } from "@/lib/http/request";
import { recordAuditEvent } from "@/lib/security/audit";
import { logEvent } from "@/lib/observability/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Self-service personal data portability endpoint returning the authenticated user's
 * account profile and authored articles/pages without password hashes or tenant secrets.
 *
 * @param req - Incoming `NextRequest`.
 * @returns JSON attachment download or `401` / `404` / `429` error status.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionUser = await getCurrentUser();
  if (!sessionUser || !sessionUser.exists) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req.headers);
  const rl = checkRateLimit(`self-export:${sessionUser.userId}:${clientIp}`, RATE_LIMITS.default);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const db = getDb();
  const profile = db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      siteId: users.siteId,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, sessionUser.userId))
    .get();

  if (!profile) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const authoredPosts = db
    .select({
      id: posts.id,
      siteId: posts.siteId,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      locale: posts.locale,
      excerpt: posts.excerpt,
      contentFormat: posts.contentFormat,
      content: posts.content,
      contentHtml: posts.contentHtml,
      contentMd: posts.contentMd,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.authorId, profile.id))
    .orderBy(desc(posts.createdAt))
    .all();

  const authoredPages = db
    .select({
      id: pages.id,
      siteId: pages.siteId,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      locale: pages.locale,
      excerpt: pages.excerpt,
      contentFormat: pages.contentFormat,
      content: pages.content,
      contentHtml: pages.contentHtml,
      contentMd: pages.contentMd,
      publishedAt: pages.publishedAt,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(eq(pages.authorId, profile.id))
    .orderBy(desc(pages.createdAt))
    .all();

  const payload = {
    exportedAt: new Date().toISOString(),
    account: profile,
    authoredPosts,
    authoredPages,
  };

  recordAuditEvent({
    actorId: profile.id,
    actorEmail: profile.email,
    actorRole: profile.role,
    siteId: profile.siteId || undefined,
    action: "user.self_export",
    targetType: "user",
    targetId: profile.id,
    status: "success",
    ipAddress: clientIp,
    metadata: {
      postsCount: authoredPosts.length,
      pagesCount: authoredPages.length,
    },
  });

  logEvent("info", "user.self_export.completed", {
    route: "/api/users/me/export",
    requestId: getRequestId(req.headers),
    siteId: profile.siteId || undefined,
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kotonoba-user-export-${profile.id}.json"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
