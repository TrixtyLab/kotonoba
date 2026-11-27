import { z } from "zod";
import { ROLES, USER_ROLES } from "@/lib/config/constants";
import { strongPasswordSchema } from "@/lib/contracts/auth";

/** Schema validating user creation payload by administrators. */
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  password: strongPasswordSchema,
  role: z.enum(USER_ROLES).default(ROLES.AUTHOR),
  siteId: z.string().optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
});

/** Inferred payload type validated by {@link createUserSchema}. */
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Schema validating user modification payload. */
export const updateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().min(1).max(100).optional(),
  password: strongPasswordSchema.optional().or(z.literal("")),
  role: z.enum(USER_ROLES).optional(),
  siteId: z.string().optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
});

/** Inferred payload type validated by {@link updateUserSchema}. */
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
