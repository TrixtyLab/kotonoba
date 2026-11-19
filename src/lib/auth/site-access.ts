import { getDb } from "@/lib/db";
import { categories, pages, posts, tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import type { TokenPayload } from "@/lib/auth/jwt";

/**
 * Roles recognized by the CMS authorization layer.
 */
export type AuthRole = "super_admin" | "admin" | "editor" | "author";

/**
 * Resource types that can be scoped to a tenant site.
 */
export type TenantResource = "post" | "page" | "category" | "tag";

/**
 * Checks whether a session principal can operate on a tenant site.
 *
 * @param user - Authenticated user with role and tenant assignment.
 * @param siteId - Site being accessed.
 * @returns `true` for super administrators and users assigned to that exact site.
 */
export function canAccessSite(
  user: Pick<TokenPayload, "role" | "siteId">,
  siteId: string
): boolean {
  if (!siteId) return false;
  if (user.role === "super_admin") return true;
  return Boolean(user.siteId) && user.siteId === siteId;
}

/**
 * Ensures the authenticated user can operate on the requested tenant site.
 *
 * Super administrators retain global access. Every other role must be assigned
 * to the exact site they are trying to read or mutate. This guard intentionally
 * derives the tenant from the session instead of trusting a client-supplied value.
 *
 * @param siteId - Site identifier that owns the target resource.
 * @param allowedRoles - Optional role allowlist for the operation.
 * @returns The authenticated user with a validated tenant scope.
 * @throws {Error} `UNAUTHORIZED`, `FORBIDDEN`, or `INVALID_SITE` when access is denied.
 */
export async function requireSiteAccess(
  siteId: string,
  allowedRoles?: AuthRole[]
): Promise<TokenPayload> {
  const user = await requireAuth(allowedRoles);

  if (!siteId) {
    throw new Error("INVALID_SITE");
  }

  if (!canAccessSite(user, siteId)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/**
 * Resolves the tenant that owns a resource and verifies access to it.
 *
 * Use this for mutations addressed by resource ID (for example, editing a post)
 * so the client cannot move the operation to another tenant by changing an ID.
 *
 * @param resource - Resource type being accessed.
 * @param resourceId - Unique identifier of the resource.
 * @param allowedRoles - Optional role allowlist for the operation.
 * @returns The authenticated user and the resource's owning site ID.
 * @throws {Error} `NOT_FOUND`, `UNAUTHORIZED`, or `FORBIDDEN` when access is denied.
 */
export async function requireResourceAccess(
  resource: TenantResource,
  resourceId: string,
  allowedRoles?: AuthRole[]
): Promise<{ user: TokenPayload; siteId: string }> {
  const db = getDb();
  let siteId: string | undefined;

  switch (resource) {
    case "post":
      siteId = db
        .select({ siteId: posts.siteId })
        .from(posts)
        .where(eq(posts.id, resourceId))
        .get()?.siteId;
      break;
    case "page":
      siteId = db
        .select({ siteId: pages.siteId })
        .from(pages)
        .where(eq(pages.id, resourceId))
        .get()?.siteId;
      break;
    case "category":
      siteId = db
        .select({ siteId: categories.siteId })
        .from(categories)
        .where(eq(categories.id, resourceId))
        .get()?.siteId;
      break;
    case "tag":
      siteId = db
        .select({ siteId: tags.siteId })
        .from(tags)
        .where(eq(tags.id, resourceId))
        .get()?.siteId;
      break;
  }

  if (!siteId) {
    throw new Error("NOT_FOUND");
  }

  const user = await requireSiteAccess(siteId, allowedRoles);
  return { user, siteId };
}
