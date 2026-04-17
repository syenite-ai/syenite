import "dotenv/config";
import { getPool, hasDatabase, closePool } from "../data/db.js";

async function main() {
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to migrate.");
    process.exit(1);
  }

  const pool = getPool();
  console.log("Applying usage_logs v0.6 migration (chain, protocol columns)...");

  await pool.query(`
    ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS chain TEXT;
    ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS protocol TEXT;
    CREATE INDEX IF NOT EXISTS idx_usage_chain ON usage_logs(chain);
    CREATE INDEX IF NOT EXISTS idx_usage_protocol ON usage_logs(protocol);
  `);

  const res = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'usage_logs'
     ORDER BY ordinal_position`
  );
  console.log("\nusage_logs schema after migration:");
  for (const c of res.rows) {
    console.log(`  ${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}`);
  }

  const counts = await pool.query<{ total: string; with_chain: string; with_protocol: string }>(
    `SELECT COUNT(*)::int as total,
            SUM(CASE WHEN chain IS NOT NULL THEN 1 ELSE 0 END)::int as with_chain,
            SUM(CASE WHEN protocol IS NOT NULL THEN 1 ELSE 0 END)::int as with_protocol
     FROM usage_logs`
  );
  const row = counts.rows[0];
  console.log(
    `\nRows: total=${row.total}, with chain=${row.with_chain}, with protocol=${row.with_protocol}`
  );
  console.log("Historic rows remain NULL (no inference).");

  await closePool();
}

main().catch(async (e) => {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
