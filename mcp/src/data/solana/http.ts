import { log } from "../../logging/logger.js";

export interface FetchJsonOptions {
  timeoutMs?: number;
  init?: RequestInit;
  label: string;
}

/**
 * Fetch JSON with a timeout. On failure, logs and returns null — never throws.
 * Solana public APIs are best-effort discovery sources.
 */
export async function fetchJson<T>(
  url: string,
  opts: FetchJsonOptions,
): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  try {
    const resp = await fetch(url, {
      ...opts.init,
      headers: { Accept: "application/json", ...(opts.init?.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      log.warn(`Solana API non-2xx: ${opts.label}`, {
        url,
        status: resp.status,
      });
      return null;
    }
    return (await resp.json()) as T;
  } catch (e) {
    log.warn(`Solana API fetch failed: ${opts.label}`, {
      url,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
