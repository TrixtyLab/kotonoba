import { getAnalyticsRetentionDays, getBackupEncryptionEnv, getCspModeEnv, getDubEnvConfig } from "@/lib/config/env";

/**
 * Reports whether legacy plaintext/compat backup archive fallback decryption is allowed.
 */
export function isLegacyBackupImportEnabled(): boolean {
  return getBackupEncryptionEnv().allowLegacy;
}

/**
 * Reports whether strict Content-Security-Policy enforcement is active instead of report-only mode.
 */
export function isEnforcedCspActive(): boolean {
  return getCspModeEnv() === "enforce";
}

/**
 * Reports whether the Dub.co short-link integration flag is enabled via `DUB_API_KEY`.
 */
export function isDubFeatureEnabled(): boolean {
  return Boolean(getDubEnvConfig().apiKey);
}

/**
 * Reports whether automated analytics raw-hit pruning is active (`ANALYTICS_RETENTION_DAYS > 0`).
 */
export function isAnalyticsPruningEnabled(): boolean {
  return getAnalyticsRetentionDays() > 0;
}
