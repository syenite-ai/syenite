import "dotenv/config";
import { getPool, hasDatabase, closePool } from "../data/db.js";
import { hashIp } from "../logging/usage.js";

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

async function main() {
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to backfill.");
    process.exit(1);
  }

  const pool = getPool();
  console.log("Scanning usage_logs for api_key rows that look like raw IPv4 addresses...");

  const res = await pool.query<{ api_key: string; count: string }>(
    `SELECT api_key, COUNT(*)::int as count
     FROM usage_logs
     WHERE api_key IS NOT NULL AND api_key ~ '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'
     GROUP BY api_key
     ORDER BY count DESC`
  );

  if (res.rows.length === 0) {
    console.log("No raw-IP rows found. Nothing to do.");
    await closePool();
    return;
  }

  const dryRun = process.argv.includes("--dry-run");
  console.log(`Found ${res.rows.length} distinct raw-IP keys.`);
  let updated = 0;
  for (const row of res.rows) {
    if (!IPV4_RE.test(row.api_key)) {
      console.log(`  skip non-IPv4 match: ${row.api_key}`);
      continue;
    }
    const hashed = hashIp(row.api_key);
    console.log(
      `  ${row.api_key} (${row.count} rows)  ->  ${hashed}${dryRun ? "  [dry-run]" : ""}`
    );
    if (!dryRun) {
      const up = await pool.query(
        "UPDATE usage_logs SET api_key = $1 WHERE api_key = $2",
        [hashed, row.api_key]
      );
      updated += up.rowCount ?? 0;
    }
  }

  if (dryRun) {
    console.log("\nDry run. Re-run without --dry-run to apply.");
  } else {
    console.log(`\nUpdated ${updated} row(s).`);
  }
  await closePool();
}

main().catch(async (e) => {
  console.error("Backfill failed:", e instanceof Error ? e.message : e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
