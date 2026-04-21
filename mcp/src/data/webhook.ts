import { log } from "../logging/logger.js";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 5_000, 15_000];
const TIMEOUT_MS = 10_000;

export interface WebhookPayload {
  source: "syenite-alerts";
  version: "1.0";
  timestamp: string;
  alert: {
    watchId: string;
    type: string;
    severity: string;
    message: string;
    data: Record<string, unknown>;
  };
}

function buildPayload(alert: {
  watchId: string;
  type: string;
  severity: string;
  message: string;
  data: Record<string, unknown>;
}): WebhookPayload {
  return {
    source: "syenite-alerts",
    version: "1.0",
    timestamp: new Date().toISOString(),
    alert: {
      watchId: alert.watchId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data,
    },
  };
}

async function attemptDelivery(url: string, payload: WebhookPayload): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Syenite-Alerts/1.0",
        "X-Syenite-Event": payload.alert.type,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Delivers an alert to a webhook URL with retry logic.
 * Fire-and-forget: errors are logged, never thrown to callers.
 */
export async function deliverWebhook(
  url: string,
  alert: {
    watchId: string;
    type: string;
    severity: string;
    message: string;
    data: Record<string, unknown>;
  }
): Promise<boolean> {
  const payload = buildPayload(alert);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const success = await attemptDelivery(url, payload);
    if (success) {
      log.info("webhook delivered", { watchId: alert.watchId, url, attempt });
      return true;
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt] ?? 15_000;
      log.warn("webhook delivery failed, retrying", {
        watchId: alert.watchId,
        url,
        attempt,
        nextRetryMs: delay,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  log.error("webhook delivery exhausted retries", {
    watchId: alert.watchId,
    url,
    maxRetries: MAX_RETRIES,
  });
  return false;
}
