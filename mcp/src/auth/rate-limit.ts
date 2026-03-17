const windows = new Map<string, { count: number; resetAt: number }>();

const MAX_REQUESTS_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = windows.get(identifier);

  if (!entry || entry.resetAt < now) {
    windows.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - 1, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  const remaining = MAX_REQUESTS_PER_MINUTE - entry.count;

  if (remaining < 0) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining, resetAt: entry.resetAt };
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key);
  }
}, 60_000);
