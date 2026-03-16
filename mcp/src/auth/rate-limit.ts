const windows = new Map<string, { count: number; resetAt: number }>();

const MAX_REQUESTS_PER_MINUTE = 100;
const WINDOW_MS = 60_000;

export function checkRateLimit(apiKey: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = windows.get(apiKey);

  if (!entry || entry.resetAt < now) {
    windows.set(apiKey, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  const remaining = MAX_REQUESTS_PER_MINUTE - entry.count;

  if (remaining < 0) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining, resetAt: entry.resetAt };
}

// Purge expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key);
  }
}, 60_000);
