import { randomBytes } from "node:crypto";
import { getDb } from "../data/cache.js";

export function generateApiKey(): string {
  return `sk_${randomBytes(24).toString("hex")}`;
}

export function createApiKey(name: string, email?: string): { key: string; id: number } {
  const db = getDb();
  const key = generateApiKey();
  const prefix = key.slice(0, 10);
  const stmt = db.prepare(
    "INSERT INTO api_keys (key, key_prefix, name, email) VALUES (?, ?, ?, ?)"
  );
  const result = stmt.run(key, prefix, name, email ?? null);
  return { key, id: result.lastInsertRowid as number };
}

export function validateApiKey(key: string): { valid: boolean; name?: string } {
  if (!key || !key.startsWith("sk_")) return { valid: false };
  const db = getDb();
  const row = db
    .prepare("SELECT name, revoked FROM api_keys WHERE key = ?")
    .get(key) as { name: string; revoked: number } | undefined;
  if (!row || row.revoked === 1) return { valid: false };
  return { valid: true, name: row.name };
}

export function revokeApiKey(key: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE api_keys SET revoked = 1 WHERE key = ?")
    .run(key);
  return result.changes > 0;
}

/**
 * Ensures a seed API key from SEED_API_KEY env var exists in the DB.
 * Solves ephemeral storage (App Platform) — key survives redeploys via env config.
 */
export function seedApiKeyFromEnv(): void {
  const seedKey = process.env.SEED_API_KEY;
  if (!seedKey) return;

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM api_keys WHERE key = ?")
    .get(seedKey);
  if (existing) return;

  const prefix = seedKey.slice(0, 10);
  db.prepare(
    "INSERT INTO api_keys (key, key_prefix, name, email) VALUES (?, ?, ?, ?)"
  ).run(seedKey, prefix, "seed (env)", null);
  console.log(`Seeded API key from SEED_API_KEY env var (prefix: ${prefix})`);
}

export function listApiKeys(): Array<{
  id: number;
  prefix: string;
  name: string;
  email: string | null;
  createdAt: string;
  revoked: boolean;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, key_prefix, name, email, created_at, revoked FROM api_keys ORDER BY created_at DESC"
    )
    .all() as Array<{
    id: number;
    key_prefix: string;
    name: string;
    email: string | null;
    created_at: string;
    revoked: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    prefix: r.key_prefix,
    name: r.name,
    email: r.email,
    createdAt: r.created_at,
    revoked: r.revoked === 1,
  }));
}
