import type JSZip from "jszip";

export interface BackupDataCategory {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface BackupDataTag {
  id?: string;
  name?: string;
  slug?: string;
}

export interface BackupDataPostCategory {
  postId: string;
  categoryId: string;
}

export interface BackupDataPostTag {
  postId: string;
  tagId: string;
}

export interface BackupDataPost {
  id?: string;
  title?: string;
  slug?: string;
  authorId?: string;
  content?: string;
  contentMd?: string;
  contentHtml?: string;
  contentFormat?: "html" | "markdown";
  excerpt?: string;
  coverImage?: string | null;
  status?: string;
  locale?: string;
  publishedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  views?: number;
  pinned?: boolean | number;
  shortUrl?: string | null;
  dubLinkId?: string | null;
}

export interface BackupDataPage {
  id?: string;
  title?: string;
  slug?: string;
  authorId?: string;
  content?: string;
  contentMd?: string;
  contentHtml?: string;
  contentFormat?: "html" | "markdown";
  excerpt?: string;
  coverImage?: string | null;
  status?: string;
  locale?: string;
  publishedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  views?: number;
}

export interface BackupDataSetting {
  key?: string;
  value?: string;
}

export interface BackupDataSegment {
  id?: string;
  name?: string;
  filters?: string;
  createdAt?: string | number | Date | null;
}

export interface BackupDataAnalytic {
  id?: number;
  postId?: string | null;
  pageId?: string | null;
  path?: string;
  referrer?: string | null;
  userAgent?: string | null;
  ipHash?: string;
  country?: string | null;
  city?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  language?: string | null;
  sessionId?: string | null;
  loadTime?: number | null;
  timeOnPage?: number | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  createdAt?: string | number | Date | null;
}

export interface BackupDataSite {
  id?: string;
  name?: string;
  domain?: string;
  subtitle?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  locale?: string;
  theme?: string;
  customCss?: string | null;
  primaryColor?: string;
  fontFamily?: string;
  navLinks?: string;
  navAlignment?: "left" | "center" | "right";
  supportedLocales?: string;
}

export interface BackupData {
  site?: BackupDataSite;
  categories?: BackupDataCategory[];
  tags?: BackupDataTag[];
  posts?: BackupDataPost[];
  pages?: BackupDataPage[];
  postCategories?: BackupDataPostCategory[];
  postTags?: BackupDataPostTag[];
  settings?: BackupDataSetting[];
  analyticsSegments?: BackupDataSegment[];
  analytics?: BackupDataAnalytic[];
}

export interface RestoreOptions {
  mode: "merge" | "replace";
  currentUserId: string;
  /** Allows restoring an archive exported from a different site (super administrators only). */
  allowCrossSite?: boolean;
}

export interface RestoreStats {
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  settings: number;
  analyticsSegments: number;
  analytics: number;
  media: number;
}

export interface RestoreResult {
  success: boolean;
  stats: RestoreStats;
  snapshotPath?: string;
  error?: string;
  /** Site identifier recorded inside the archive, when present. */
  sourceSiteId?: string;
}

export interface PendingMediaEntry {
  zipEntry: JSZip.JSZipObject;
  relPath: string;
  destPath: string;
}

export interface StagedMediaFile {
  relPath: string;
  tempPath: string;
  destPath: string;
  size: number;
}

export interface AppliedMediaFile {
  destPath: string;
  backupPath: string | null;
}

export function emptyStats(): RestoreStats {
  return { posts: 0, pages: 0, categories: 0, tags: 0, settings: 0, analyticsSegments: 0, analytics: 0, media: 0 };
}
