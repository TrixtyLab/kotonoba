import argon2 from "argon2";

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
