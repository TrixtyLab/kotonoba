import { z } from "zod";
import { LOCALES } from "@/i18n/locales";
import { CONTENT_FORMATS, POST_STATUS, POST_STATUSES } from "@/lib/config/constants";

/** Schema validating static custom page creation and update operations. */
export const pageSchema = z.object({
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
});

/** Inferred payload type validated by {@link pageSchema}. */
export type PageInput = z.infer<typeof pageSchema>;
