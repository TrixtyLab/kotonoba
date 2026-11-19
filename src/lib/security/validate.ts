import { z, type ZodSchema } from "zod";
import { LOCALES } from "@/i18n/locales";

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

/** Schema enforcing strong password policy for new accounts and password changes. */
export const strongPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters long.")
  .max(128)
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

/** Schema validating user authentication credentials for sign in. */
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Schema validating blog post creation and update operations. */
export const postSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  contentMd: z.string().max(500000).default(""),
  contentHtml: z.string().max(1000000).default(""),
  contentFormat: z.enum(["html", "markdown"]).optional(),
  excerpt: z.string().max(1000).default(""),
  coverImage: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published", "scheduled", "archived"]).default("draft"),
  publishedAt: z.string().or(z.date()).optional().nullable(),
  locale: z.enum(LOCALES).default("en"),
  categoryIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  shortUrl: z.string().max(2000).optional().nullable(),
  dubLinkId: z.string().max(200).optional().nullable(),
});
export type PostInput = z.infer<typeof postSchema>;

/** Schema validating static custom page creation and update operations. */
export const pageSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).optional(),
  contentMd: z.string().max(500000).default(""),
  contentHtml: z.string().max(1000000).default(""),
  contentFormat: z.enum(["html", "markdown"]).optional(),
  excerpt: z.string().max(1000).default(""),
  coverImage: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published", "scheduled", "archived"]).default("draft"),
  publishedAt: z.string().or(z.date()).optional().nullable(),
  locale: z.enum(LOCALES).default("en"),
});
export type PageInput = z.infer<typeof pageSchema>;

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
  locale: z.enum(LOCALES).default("en"),
  theme: z.enum(["dark", "light"]).default("dark"),
  customCss: z.string().max(50000).optional().nullable(),
  primaryColor: z.string().max(7).default("#6366f1"),
  fontFamily: z.string().max(100).default("Inter"),
  navLinks: z.string().default("[]"),
  navAlignment: z.enum(["left", "center", "right"]).default("left"),
  supportedLocales: z.string().max(2000).optional().nullable(),
});
export type SiteInput = z.infer<typeof siteSchema>;

/** Schema validating user creation payload by administrators. */
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  password: strongPasswordSchema,
  role: z.enum(["super_admin", "admin", "editor", "author"]).default("author"),
  siteId: z.string().optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Schema validating user modification payload. */
export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().min(1).max(100).optional(),
  password: strongPasswordSchema.optional().or(z.literal("")),
  role: z.enum(["super_admin", "admin", "editor", "author"]).optional(),
  siteId: z.string().optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

