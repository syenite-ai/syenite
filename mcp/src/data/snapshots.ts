import { getPool } from "./db.js";

const MIN_SNAPSHOT_INTERVAL_S = 3600;
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_RETENTION_DAYS = 30;
const MIN_HISTORY_S = 86400;

export async function recordSnapshot(key: string, value: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const res = await getPool().query<{ recorded_at: string }>(
    "SELECT recorded_at FROM snapshots WHERE key = $1 ORDER BY recorded_at DESC LIMIT 1",
    [key]
  );
  const latest = res.rows[0];
  if (latest && now - Number(latest.recorded_at) < MIN_SNAPSHOT_INTERVAL_S) return;

  await getPool().query(
    `INSERT INTO snapshots (key, value, recorded_at) VALUES ($1, $2, $3)
     ON CONFLICT (key, recorded_at) DO NOTHING`,
    [key, value, now]
  );
}

export async function getTrailingAPY(key: string, windowDays: number = DEFAULT_WINDOW_DAYS): Promise<number | null> {
  const pool = getPool();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowDays * 86400;

  const oldestRes = await pool.query<{ value: string; recorded_at: string }>(
    "SELECT value, recorded_at FROM snapshots WHERE key = $1 AND recorded_at >= $2 ORDER BY recorded_at ASC LIMIT 1",
    [key, windowStart]
  );
  const newestRes = await pool.query<{ value: string; recorded_at: string }>(
    "SELECT value, recorded_at FROM snapshots WHERE key = $1 ORDER BY recorded_at DESC LIMIT 1",
    [key]
  );
  const oldest = oldestRes.rows[0];
  const newest = newestRes.rows[0];
  if (!oldest || !newest) return null;

  const deltaSeconds = Number(newest.recorded_at) - Number(oldest.recorded_at);
  if (deltaSeconds < MIN_HISTORY_S) return null;
  const oldestVal = Number(oldest.value);
  if (oldestVal <= 0) return null;

  const growth = Number(newest.value) / oldestVal - 1;
  const deltaDays = deltaSeconds / 86400;
  return growth * (365 / deltaDays) * 100;
}

export async function pruneSnapshots(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const res = await getPool().query("DELETE FROM snapshots WHERE recorded_at < $1", [cutoff]);
  return res.rowCount ?? 0;
}
