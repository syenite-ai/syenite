import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const preferred = process.env.DATABASE_PATH;
  if (preferred) {
    const dir = dirname(preferred);
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      return preferred;
    } catch {
      console.warn(`Cannot create ${dir}, falling back to /tmp/syenite.db`);
    }
  }
  return "/tmp/syenite.db";
}

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;
  const path = dbPath ?? resolveDbPath();
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key         TEXT,
      tool_name       TEXT NOT NULL,
      params_hash     TEXT,
      response_time_ms INTEGER NOT NULL,
      success         INTEGER NOT NULL DEFAULT 1,
      error_message   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_tool    ON usage_logs(tool_name);
    CREATE INDEX IF NOT EXISTS idx_usage_key     ON usage_logs(api_key);
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

    CREATE TABLE IF NOT EXISTS snapshots (
      key         TEXT NOT NULL,
      value       REAL NOT NULL,
      recorded_at INTEGER NOT NULL,
      PRIMARY KEY (key, recorded_at)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_key ON snapshots(key, recorded_at);
  `);
}

// ── Cache operations ────────────────────────────────────────────────

export function cacheGet<T>(key: string): T | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value, expires_at FROM cache WHERE key = ?")
    .get(key) as { value: string; expires_at: number } | undefined;

  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    db.prepare("DELETE FROM cache WHERE key = ?").run(key);
    return null;
  }
  return JSON.parse(row.value) as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  const db = getDb();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.prepare(
    "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)"
  ).run(key, JSON.stringify(value), expiresAt);
}

export function cachePurgeExpired(): number {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM cache WHERE expires_at < ?")
    .run(Math.floor(Date.now() / 1000));
  return result.changes;
}
