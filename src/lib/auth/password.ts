import argon2 from "argon2";

/**
 * Fixed Argon2id hash (same memory, time, and parallelism as {@link hashPassword}).
 * Login verifies this when the email is unknown so the response time matches a real account.
 */
export const LOGIN_TIMING_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$sXbiChaub0lWmbh6P1N+cg$SoLgKwWz/B9Vj6yKskY0s/9BHuMz8p9sXEebykKxgxI";

/**
 * Hashes a plaintext password using the state-of-the-art Argon2id cryptographic algorithm.
 * Uses high memory and time parameters for strong resistance against GPU brute-force attacks.
 *
 * @param password - The raw plaintext password string to hash.
 * @returns A Promise resolving to the encoded Argon2id hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plaintext password against an existing Argon2id hash.
 *
 * @param hash - The stored Argon2id hash string.
 * @param password - The candidate plaintext password string to test.
 * @returns A Promise resolving to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
