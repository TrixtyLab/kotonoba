import { z } from "zod";

/** Schema validating category creation and editing parameters. */
export const categorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).default(""),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

/** Inferred payload type validated by {@link categorySchema}. */
export type CategoryInput = z.infer<typeof categorySchema>;

/** Schema validating taxonomy tag parameters. */
export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
});

/** Inferred payload type validated by {@link tagSchema}. */
export type TagInput = z.infer<typeof tagSchema>;
