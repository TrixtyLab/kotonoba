import { z } from "zod";
import { LOCALES } from "@/i18n/locales";
import { CONTENT_FORMATS, POST_STATUS, POST_STATUSES } from "@/lib/config/constants";

/** Schema validating blog post creation and update operations. */
export const postSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  content: z.string().max(1000000).optional(),
  contentMd: z.string().max(500000).default(""),
  contentHtml: z.string().max(1000000).default(""),
  contentFormat: z.enum(CONTENT_FORMATS).optional(),
  excerpt: z.string().max(1000).default(""),
  coverImage: z.string().max(2000).optional().nullable(),
  status: z.enum(POST_STATUSES).default(POST_STATUS.DRAFT),
  publishedAt: z.string().or(z.date()).optional().nullable(),
  locale: z.enum(LOCALES).default("en"),
  categoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  shortUrl: z.string().max(2000).optional().nullable(),
  dubLinkId: z.string().max(200).optional().nullable(),
});

/** Inferred payload type validated by {@link postSchema}. */
export type PostInput = z.infer<typeof postSchema>;
