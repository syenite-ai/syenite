import { randomBytes } from "node:crypto";
import { getPool } from "../data/db.js";

export function generateApiKey(): string {
  return `sk_${randomBytes(24).toString("hex")}`;
}

export async function createApiKey(name: string, email?: string): Promise<{ key: string; id: number }> {
  const key = generateApiKey();
  const prefix = key.slice(0, 10);
  const res = await getPool().query<{ id: string }>(
    "INSERT INTO api_keys (key, key_prefix, name, email) VALUES ($1, $2, $3, $4) RETURNING id",
    [key, prefix, name, email ?? null]
  );
  return { key, id: Number(res.rows[0].id) };
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; name?: string }> {
  if (!key || !key.startsWith("sk_")) return { valid: false };
  const res = await getPool().query<{ name: string; revoked: string }>(
    "SELECT name, revoked FROM api_keys WHERE key = $1",
    [key]
  );
  const row = res.rows[0];
  if (!row || Number(row.revoked) === 1) return { valid: false };
  return { valid: true, name: row.name };
}

export async function revokeApiKey(key: string): Promise<boolean> {
  const res = await getPool().query("UPDATE api_keys SET revoked = 1 WHERE key = $1", [key]);
  return (res.rowCount ?? 0) > 0;
}

export async function seedApiKeyFromEnv(): Promise<void> {
  const seedKey = process.env.SEED_API_KEY;
  if (!seedKey) return;

  const existing = await getPool().query("SELECT id FROM api_keys WHERE key = $1", [seedKey]);
  if (existing.rows.length > 0) return;

  const prefix = seedKey.slice(0, 10);
  await getPool().query(
    "INSERT INTO api_keys (key, key_prefix, name, email) VALUES ($1, $2, $3, $4)",
    [seedKey, prefix, "seed (env)", null]
  );
  console.log(`Seeded API key from SEED_API_KEY env var (prefix: ${prefix})`);
}

export async function listApiKeys(): Promise<Array<{
  id: number;
  prefix: string;
  name: string;
  email: string | null;
  createdAt: string;
  revoked: boolean;
}>> {
  const res = await getPool().query<{
    id: string;
    key_prefix: string;
    name: string;
    email: string | null;
    created_at: string;
    revoked: string;
  }>(
    "SELECT id, key_prefix, name, email, created_at, revoked FROM api_keys ORDER BY created_at DESC"
  );
  return res.rows.map((r: { id: string; key_prefix: string; name: string; email: string | null; created_at: string; revoked: string }) => ({
    id: Number(r.id),
    prefix: r.key_prefix,
    name: r.name,
    email: r.email,
    createdAt: r.created_at,
    revoked: Number(r.revoked) === 1,
  }));
}
