import { log } from "../logging/logger.js";
import type { Alert } from "./alerts.js";

export interface WebhookResult {
  delivered: boolean;
  status?: number;
  error?: string;
}

export async function sendWebhook(url: string, alert: Alert): Promise<WebhookResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "syenite-alerts/0.6",
      },
      body: JSON.stringify({
        source: "syenite",
        alert: {
          watchId: alert.watchId,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          data: alert.data,
          createdAt: alert.createdAt,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      log.warn("webhook delivery non-2xx", { url, status: res.status, watchId: alert.watchId });
      return { delivered: false, status: res.status };
    }
    return { delivered: true, status: res.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.warn("webhook delivery failed", { url, watchId: alert.watchId, error });
    return { delivered: false, error };
  }
}
