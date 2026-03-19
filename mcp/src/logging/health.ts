import { getPool } from "../data/db.js";
import { getClient } from "../data/client.js";
import { log } from "./logger.js";

export async function getHealthStatus(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { ok: boolean; message: string; latencyMs?: number }>;
  uptime: number;
}> {
  const startTime = process.uptime();
  const checks: Record<string, { ok: boolean; message: string; latencyMs?: number }> = {};

  try {
    const dbStart = Date.now();
    await getPool().query("SELECT 1");
    checks.database = { ok: true, message: "connected", latencyMs: Date.now() - dbStart };
  } catch (e) {
    log.warn("health: db error", { error: e instanceof Error ? e.message : String(e) });
    checks.database = { ok: false, message: "unavailable" };
  }

  try {
    const rpcStart = Date.now();
    const client = getClient();
    await client.getBlockNumber();
    const rpcLatency = Date.now() - rpcStart;
    checks.rpc = { ok: true, message: "connected", latencyMs: rpcLatency };
  } catch (e) {
    log.warn("health: rpc error", { error: e instanceof Error ? e.message : String(e) });
    checks.rpc = { ok: false, message: "unavailable" };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const anyOk = Object.values(checks).some((c) => c.ok);

  return {
    status: allOk ? "healthy" : anyOk ? "degraded" : "unhealthy",
    checks,
    uptime: Math.round(startTime),
  };
}
