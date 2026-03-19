import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required (e.g. from DO Managed Postgres)");
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initSchema(): Promise<void> {
  const client = getPool();
  await client.query(`
    CREATE TABLE IF NOT EXISTS cache (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

    CREATE TABLE IF NOT EXISTS api_keys (
      id         SERIAL PRIMARY KEY,
      key        TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name       TEXT NOT NULL,
      email       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked     SMALLINT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id               SERIAL PRIMARY KEY,
      api_key          TEXT,
      tool_name        TEXT NOT NULL,
      params_hash      TEXT,
      response_time_ms INTEGER NOT NULL,
      success          SMALLINT NOT NULL DEFAULT 1,
      error_message    TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_tool ON usage_logs(tool_name);
    CREATE INDEX IF NOT EXISTS idx_usage_key ON usage_logs(api_key);

    CREATE TABLE IF NOT EXISTS snapshots (
      key         TEXT NOT NULL,
      value       DOUBLE PRECISION NOT NULL,
      recorded_at BIGINT NOT NULL,
      PRIMARY KEY (key, recorded_at)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_key ON snapshots(key, recorded_at);
  `);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
