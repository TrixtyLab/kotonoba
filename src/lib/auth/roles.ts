import type { AuthRole } from "@/lib/auth/site-access";
import { ROLES, USER_ROLES } from "@/lib/config/constants";

/** All authenticated editorial and administrative roles. */
export const ROLE_ALL: AuthRole[] = [...USER_ROLES];

/** Roles permitted to manage site-wide content, categories, and tags. */
export const ROLE_PUBLISHERS: AuthRole[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EDITOR];

/** Roles permitted to manage tenant settings, users, and encrypted backups. */
export const ROLE_ADMINS: AuthRole[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

/** Platform-wide super-administrator role only. */
export const ROLE_SUPER_ADMIN: AuthRole[] = [ROLES.SUPER_ADMIN];

/** Returns `true` when the role can manage site settings or backups. */
export function canManageSettings(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

/** Returns `true` when the role can export or restore backups. */
export function canManageBackups(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

/** Returns `true` when the role can create, edit, or delete tenant sites. */
export function canManageSites(role: string): boolean {
  return role === ROLES.SUPER_ADMIN;
}

/** Returns `true` when the role can create or manage user accounts. */
export function canManageUsers(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}
