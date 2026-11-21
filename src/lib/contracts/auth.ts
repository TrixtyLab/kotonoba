import { z } from "zod";

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

/** Inferred payload type validated by {@link loginSchema}. */
export type LoginInput = z.infer<typeof loginSchema>;
