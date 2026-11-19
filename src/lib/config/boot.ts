/**
 * Edge-safe server startup check invoked from `src/instrumentation.ts` `register()`.
 * Uses dynamic import inside the Node.js runtime guard so Edge compilation never traces
 * Node-only modules (`path`, etc.).
 */
export async function assertServerBootConfig(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  const { getJwtSecretString, getEncryptionSecretString } = await import("./secrets");
  getJwtSecretString();
  getEncryptionSecretString();
}
