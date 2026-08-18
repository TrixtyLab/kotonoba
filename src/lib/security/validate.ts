import { z, type ZodSchema } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

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

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

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
});
export type PostInput = z.infer<typeof postSchema>;

export const categorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).default(""),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
});
export type TagInput = z.infer<typeof tagSchema>;

export const siteSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().min(1).max(500),
  subtitle: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  locale: z.string().min(2).max(10).default("en"),
  theme: z.enum(["dark", "light"]).default("dark"),
  primaryColor: z.string().max(7).default("#6366f1"),
  fontFamily: z.string().max(100).default("Inter"),
});
export type SiteInput = z.infer<typeof siteSchema>;

export const settingsSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10000),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const aiConfigSchema = z.object({
  apiUrl: z.string().url().max(500).default("https://api.openai.com/v1"),
  apiKey: z.string().min(1).max(500),
  model: z.string().min(1).max(100).default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
  enabled: z.boolean().default(true),
});
export type AiConfigInput = z.infer<typeof aiConfigSchema>;
