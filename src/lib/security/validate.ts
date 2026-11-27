import type { ZodSchema } from "zod";

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
