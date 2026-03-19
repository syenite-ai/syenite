import { getPool } from "./db.js";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const res = await getPool().query<{ value: string; expires_at: string }>(
    "SELECT value, expires_at FROM cache WHERE key = $1",
    [key]
  );
  const row = res.rows[0];
  if (!row) return null;
  const expiresAt = Number(row.expires_at);
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await getPool().query("DELETE FROM cache WHERE key = $1", [key]);
    return null;
  }
  return JSON.parse(row.value) as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await getPool().query(
    `INSERT INTO cache (key, value, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = $3`,
    [key, JSON.stringify(value), expiresAt]
  );
}

export async function cachePurgeExpired(): Promise<number> {
  const res = await getPool().query(
    "DELETE FROM cache WHERE expires_at < $1",
    [Math.floor(Date.now() / 1000)]
  );
  return res.rowCount ?? 0;
}
