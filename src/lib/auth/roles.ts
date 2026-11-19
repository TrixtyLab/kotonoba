import type { AuthRole } from "@/lib/auth/site-access";

/** All authenticated editorial and administrative roles. */
export const ROLE_ALL: AuthRole[] = ["super_admin", "admin", "editor", "author"];

/** Roles permitted to manage site-wide content, categories, and tags. */
export const ROLE_PUBLISHERS: AuthRole[] = ["super_admin", "admin", "editor"];

/** Roles permitted to manage tenant settings, users, and encrypted backups. */
export const ROLE_ADMINS: AuthRole[] = ["super_admin", "admin"];

/** Platform-wide super-administrator role only. */
export const ROLE_SUPER_ADMIN: AuthRole[] = ["super_admin"];

/** Returns `true` when the role can manage site settings or backups. */
export function canManageSettings(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

/** Returns `true` when the role can export or restore backups. */
export function canManageBackups(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

/** Returns `true` when the role can create, edit, or delete tenant sites. */
export function canManageSites(role: string): boolean {
  return role === "super_admin";
}

/** Returns `true` when the role can create or manage user accounts. */
export function canManageUsers(role: string): boolean {
  return role === "super_admin" || role === "admin";
}
