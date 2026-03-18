import { getDb } from "./cache.js";

const MIN_SNAPSHOT_INTERVAL_S = 3600; // 1 hour between snapshots for same key
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_RETENTION_DAYS = 30;
const MIN_HISTORY_S = 86400; // need at least 24h of data for meaningful APY

export function recordSnapshot(key: string, value: number): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const latest = db
    .prepare("SELECT recorded_at FROM snapshots WHERE key = ? ORDER BY recorded_at DESC LIMIT 1")
    .get(key) as { recorded_at: number } | undefined;

  if (latest && now - latest.recorded_at < MIN_SNAPSHOT_INTERVAL_S) return;

  db.prepare("INSERT OR IGNORE INTO snapshots (key, value, recorded_at) VALUES (?, ?, ?)")
    .run(key, value, now);
}

/**
 * Compute trailing APY from stored snapshots.
 * Returns null if insufficient history (< 24h).
 */
export function getTrailingAPY(key: string, windowDays: number = DEFAULT_WINDOW_DAYS): number | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowDays * 86400;

  const oldest = db
    .prepare("SELECT value, recorded_at FROM snapshots WHERE key = ? AND recorded_at >= ? ORDER BY recorded_at ASC LIMIT 1")
    .get(key, windowStart) as { value: number; recorded_at: number } | undefined;

  const newest = db
    .prepare("SELECT value, recorded_at FROM snapshots WHERE key = ? ORDER BY recorded_at DESC LIMIT 1")
    .get(key) as { value: number; recorded_at: number } | undefined;

  if (!oldest || !newest) return null;

  const deltaSeconds = newest.recorded_at - oldest.recorded_at;
  if (deltaSeconds < MIN_HISTORY_S) return null;
  if (oldest.value <= 0) return null;

  const growth = newest.value / oldest.value - 1;
  const deltaDays = deltaSeconds / 86400;
  return growth * (365 / deltaDays) * 100;
}

export function pruneSnapshots(retentionDays: number = DEFAULT_RETENTION_DAYS): number {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const result = db
    .prepare("DELETE FROM snapshots WHERE recorded_at < ?")
    .run(cutoff);
  return result.changes;
}
