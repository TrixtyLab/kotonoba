/**
 * Edge-safe alert dispatcher invoked from `src/instrumentation.ts` `onRequestError`.
 * Uses `NEXT_RUNTIME === "nodejs"` guard + dynamic import so Edge bundles never trace Node modules.
 */
export async function reportCriticalServerAlert(
  event: string,
  details: Record<string, string | number | null | undefined>
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { notifyCriticalAlert } = await import("../observability/alerts");
    await notifyCriticalAlert(event, details);
  }
}

/**
 * Edge-safe server startup check invoked from `src/instrumentation.ts` `register()`.
 * Uses dynamic import inside the `process.env.NEXT_RUNTIME === "nodejs"` branch so Edge
 * bundlers dead-code-prune Node-only modules (`path`, etc.).
 */
export async function assertServerBootConfig(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { getJwtSecretString, getEncryptionSecretString } = await import("./secrets");
    getJwtSecretString();
    getEncryptionSecretString();

    if (process.env.NODE_ENV === "production") {
      const { assertBackupEncryptionKey } = await import("../backup/crypto");
      assertBackupEncryptionKey();
    }
  }
}
