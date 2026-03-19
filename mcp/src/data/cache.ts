import { getPool, hasDatabase } from "./db.js";
import { recordCacheHit, recordCacheMiss } from "../logging/metrics.js";

// In-memory fallback when no DB is configured (stdio / local mode)
const memCache = new Map<string, { value: string; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!hasDatabase()) {
    const entry = memCache.get(key);
    if (!entry) { recordCacheMiss(); return null; }
    if (entry.expiresAt < Math.floor(Date.now() / 1000)) {
      memCache.delete(key);
      recordCacheMiss();
      return null;
    }
    recordCacheHit();
    return JSON.parse(entry.value) as T;
  }

  const res = await getPool().query<{ value: string; expires_at: string }>(
    "SELECT value, expires_at FROM cache WHERE key = $1",
    [key]
  );
  const row = res.rows[0];
  if (!row) {
    recordCacheMiss();
    return null;
  }
  const expiresAt = Number(row.expires_at);
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await getPool().query("DELETE FROM cache WHERE key = $1", [key]);
    recordCacheMiss();
    return null;
  }
  recordCacheHit();
  return JSON.parse(row.value) as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  if (!hasDatabase()) {
    memCache.set(key, { value: JSON.stringify(value), expiresAt });
    return;
  }

  await getPool().query(
    `INSERT INTO cache (key, value, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = $3`,
    [key, JSON.stringify(value), expiresAt]
  );
}

export async function cachePurgeExpired(): Promise<number> {
  if (!hasDatabase()) {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    for (const [key, entry] of memCache) {
      if (entry.expiresAt < now) { memCache.delete(key); count++; }
    }
    return count;
  }

  const res = await getPool().query(
    "DELETE FROM cache WHERE expires_at < $1",
    [Math.floor(Date.now() / 1000)]
  );
  return res.rowCount ?? 0;
}
