import { getCurrentUser } from "@/lib/auth/session";
import type { TokenPayload } from "@/lib/auth/jwt";
import type { AuthRole } from "@/lib/auth/site-access";
import { getAdminSite, type Site } from "@/lib/tenant";
import { redirect } from "@/i18n/routing";

export interface AdminWorkspaceContext {
  user: TokenPayload;
  site: Site;
}

/**
 * Shared guard for Admin Server Component pages enforcing session validity, allowed role
 * membership, and resolved tenant workspace access before rendering administrative panels.
 *
 * @param options - Target route locale and optional role allowlist.
 * @returns Validated user claims and active `Site` entity.
 */
export async function requireAdminWorkspace(options: {
  locale: string;
  allowedRoles?: AuthRole[];
}): Promise<AdminWorkspaceContext> {
  const user = await getCurrentUser();
  if (!user || !user.exists) {
    redirect({ href: "/login", locale: options.locale });
    throw new Error("UNAUTHORIZED");
  }

  if (options.allowedRoles && !options.allowedRoles.includes(user.role as AuthRole)) {
    redirect({ href: "/admin", locale: options.locale });
    throw new Error("FORBIDDEN");
  }

  const site = await getAdminSite();
  if (!site) {
    redirect({ href: "/admin", locale: options.locale });
    throw new Error("NO_ACTIVE_SITE");
  }

  return { user, site };
}
