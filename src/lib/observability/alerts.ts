import { getAlertWebhookUrl } from "@/lib/config/env";
import { validateOutboundUrl, safeOutboundFetch } from "@/lib/security/ssrf";

const ALERT_COOLDOWN_MS = 60_000;
const recentAlerts = new Map<string, number>();

function canEmitAlert(event: string, now = Date.now()): boolean {
  const lastSent = recentAlerts.get(event);
  if (lastSent !== undefined && now - lastSent < ALERT_COOLDOWN_MS) {
    return false;
  }
  if (recentAlerts.size >= 200) {
    const oldest = recentAlerts.keys().next().value;
    if (oldest !== undefined) recentAlerts.delete(oldest);
  }
  recentAlerts.set(event, now);
  return true;
}

/**
 * Sends a non-blocking, SSRF-validated, rate-coalesced JSON alert webhook when `ALERT_WEBHOOK_URL`
 * is configured. Never throws and never sends raw credentials or full stack traces.
 */
export async function notifyCriticalAlert(
  event: string,
  details: Record<string, string | number | null | undefined> = {}
): Promise<void> {
  const webhookUrl = getAlertWebhookUrl();
  if (!webhookUrl || !canEmitAlert(event)) {
    return;
  }

  try {
    const ssrf = await validateOutboundUrl(webhookUrl);
    if (!ssrf.valid) return;

    const payload = {
      source: "kotonoba",
      severity: "critical",
      event,
      timestamp: new Date().toISOString(),
      details,
    };

    await safeOutboundFetch(ssrf.url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Alerts must never crash callers or propagate secondary failures
  }
}
