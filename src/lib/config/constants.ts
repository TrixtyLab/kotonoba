/**
 * Named RBAC role lookup constants backing {@link USER_ROLES}.
 */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  AUTHOR: "author",
} as const;

/**
 * Canonical role identifiers enforced across authentication, session claims, and RBAC policies.
 */
export const USER_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.EDITOR,
  ROLES.AUTHOR,
] as const;

/** Union of recognized RBAC role strings. */
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Named publication status lookup constants backing {@link POST_STATUSES}.
 */
export const POST_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  ARCHIVED: "archived",
} as const;

/**
 * Lifecycle publication statuses shared by articles, custom pages, and Zod validation schemas.
 */
export const POST_STATUSES = [
  POST_STATUS.DRAFT,
  POST_STATUS.PUBLISHED,
  POST_STATUS.SCHEDULED,
  POST_STATUS.ARCHIVED,
] as const;

/** Union of valid article/page status values. */
export type PostStatus = (typeof POST_STATUSES)[number];

/** Canonical stored body format identifiers (`content_format`). */
export const CONTENT_FORMATS = ["html", "markdown"] as const;

/** Default number of articles rendered per page on public feed views. */
export const DEFAULT_PUBLIC_PAGE_SIZE = 5;

/** Upper bound for public pagination size query parameters. */
export const MAX_PUBLIC_PAGE_SIZE = 50;

/** Default number of chronological entries per archive page (`/archive`). */
export const ARCHIVE_PAGE_SIZE = 30;

/** Default number of search results returned per search page (`/api/search`). */
export const SEARCH_PAGE_LIMIT = 20;

/** Default batch size when listing directory assets in media library (`/api/media`). */
export const MEDIA_PAGE_SIZE = 60;
