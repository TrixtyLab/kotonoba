import { z, type ZodSchema } from "zod";

/**
 * Represents the discriminated union result of a Zod schema validation pass.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

/**
 * Validates arbitrary input data against a provided Zod schema, aggregating errors by field key.
 *
 * @template T - The inferred data type of the successful validation payload.
 * @template I - The input data structure being evaluated.
 * @param schema - The Zod schema against which data is verified.
 * @param data - The untrusted input object or payload to validate.
 * @returns A ValidationResult indicating either success with strongly typed data or structured field error messages.
 */
export function validate<T, I = Partial<T> | Record<string, string | number | boolean | null | undefined | string[] | number[] | object>>(
  schema: ZodSchema<T>,
  data: I
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = [];
    errors[key].push(issue.message);
  }
  return { success: false, errors };
}

/** Schema validating user authentication credentials for sign in. */
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Schema validating administrator user account creation payload. */
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Schema validating blog post creation and update operations. */
export const postSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  contentMd: z.string().max(500000).default(""),
  contentHtml: z.string().max(1000000).default(""),
  excerpt: z.string().max(1000).default(""),
  coverImage: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  locale: z.string().min(2).max(10).default("en"),
  categoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  shortUrl: z.string().max(2000).optional().nullable(),
  dubLinkId: z.string().max(200).optional().nullable(),
});
export type PostInput = z.infer<typeof postSchema>;

/** Schema validating category creation and editing parameters. */
export const categorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).default(""),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** Schema validating taxonomy tag parameters. */
export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
});
export type TagInput = z.infer<typeof tagSchema>;

/** Schema validating blog site parameters, branding, and navigation configuration. */
export const siteSchema = z.object({
  name: z.string().min(1).max(5000),
  domain: z.string().min(1).max(500),
  subtitle: z.string().max(5000).default(""),
  description: z.string().max(5000).default(""),
  logoUrl: z.string().max(2000).optional().nullable(),
  faviconUrl: z.string().max(2000).optional().nullable(),
  locale: z.string().min(2).max(10).default("en"),
  theme: z.enum(["dark", "light"]).default("dark"),
  primaryColor: z.string().max(7).default("#6366f1"),
  fontFamily: z.string().max(100).default("Inter"),
  navLinks: z.string().default("[]"),
  navAlignment: z.enum(["left", "center", "right"]).default("left"),
  supportedLocales: z.string().max(2000).optional().nullable(),
});
export type SiteInput = z.infer<typeof siteSchema>;

/** Schema validating arbitrary key-value configuration pairs. */
export const settingsSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10000),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

/** Schema validating custom OpenAI-compatible AI assistant connection configuration. */
export const aiConfigSchema = z.object({
  apiUrl: z.string().url().max(500).default("https://api.openai.com/v1"),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(100).default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
});
export type AiConfigInput = z.infer<typeof aiConfigSchema>;
